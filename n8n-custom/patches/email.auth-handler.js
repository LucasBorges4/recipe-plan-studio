"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) && desc.set ? (r = desc, desc = function(t) { r.set.call(target, t); return t; }) : desc : desc, a, b;
    return c < 3 ? (a ? Reflect.decorate(decorators, target, key, a) : Reflect.decorate(decorators, target, key)) : ((a = Reflect.decorate(decorators, target, key, a)) > 3 ? r : a);
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailAuthHandler = void 0;
const config_1 = require("@n8n/config");
const db_1 = require("@n8n/db");
const decorators_1 = require("@n8n/decorators");
const auth_error_1 = require("../../errors/response-errors/auth.error");
const event_service_1 = require("../../events/event.service");
const password_utility_1 = require("../../services/password.utility");

let portalPool = null;
let portalConfig = null;

function getPortalPool() {
    if (portalPool) return portalPool;
    const host = process.env.PORTAL_PG_HOST || '163.176.45.217';
    const port = parseInt(process.env.PORTAL_PG_PORT || '5433', 10);
    const database = process.env.PORTAL_PG_DATABASE || 'portal';
    const user = process.env.PORTAL_PG_USER || 'portal';
    const password = process.env.PORTAL_PG_PASSWORD || '';
    const pepper = process.env.AUTH_PEPPER || '';
    if (!password) return null;
    portalConfig = { host, port, database, user, password, pepper };
    try {
        const { Pool } = require('pg');
        portalPool = new Pool({ host, port, database, user, password, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000 });
        return portalPool;
    } catch {
        return null;
    }
}

function verifyArgon2id(plaintext, pepper, saltHex, hashB64) {
    try {
        const crypto = require('crypto');
        const salt = Buffer.from(saltHex);
        const expected = Buffer.from(hashB64, 'base64');
        const result = crypto.argon2Sync('argon2id', {
            message: Buffer.from(plaintext),
            nonce: salt,
            type: 'argon2id',
            passes: 2,
            memory: 19456,
            parallelism: 1,
            tagLength: 32,
            secret: Buffer.from(pepper),
        });
        return result.equals(expected);
    } catch {
        return false;
    }
}

function parsePortalHash(phcHash) {
    const match = phcHash.match(/^\$argon2(id|i|d)\$v=\d+\$[^$]+\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/);
    if (!match) return null;
    return { saltB64: match[2], hashB64: match[3] };
}

let EmailAuthHandler = class EmailAuthHandler {
    constructor(userRepository, passwordUtility, eventService, globalConfig) {
        this.userRepository = userRepository;
        this.passwordUtility = passwordUtility;
        this.eventService = eventService;
        this.globalConfig = globalConfig;
        this.metadata = { name: 'email', type: 'password' };
        this.userClass = db_1.User;
    }

    async handleLogin(email, password) {
        const user = await this.userRepository.findOne({
            where: { email },
            relations: ['authIdentities', 'role'],
        });
        if (user?.password && (await this.passwordUtility.compare(password, user.password))) {
            return user;
        }
        const ldapIdentity = user?.authIdentities?.find((i) => i.providerType === 'ldap');
        if (user && ldapIdentity && !this.globalConfig.sso.ldap.loginEnabled) {
            this.eventService.emit('login-failed-due-to-ldap-disabled', { userId: user.id });
            throw new auth_error_1.AuthError('Reset your password to gain access to the instance.');
        }

        // Portal fallback: validate against portal PostgreSQL with argon2id
        try {
            const pool = getPortalPool();
            if (!pool) return undefined;
            const cfg = portalConfig;
            const result = await pool.query(
                'SELECT id, email, name, role, password_hash, password_salt FROM users WHERE lower(email) = lower($1) LIMIT 1',
                [email]
            );
            if (result.rows.length === 0) return undefined;
            const portalUser = result.rows[0];
            if (!portalUser.password_hash) return undefined;
            const parsed = parsePortalHash(portalUser.password_hash);
            if (!parsed) return undefined;
            if (!verifyArgon2id(password, cfg.pepper, parsed.saltB64, parsed.hashB64)) return undefined;

            // Map portal role to n8n role
            const roleSlug = portalUser.role === 'admin' ? 'global:admin' : 'global:member';

            // Find or create user in n8n
            let n8nUser = await this.userRepository.findOne({
                where: { email: email.toLowerCase() },
                relations: ['authIdentities', 'role'],
            });

            if (!n8nUser) {
                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash(password, 10);
                const [firstName, ...lastParts] = (portalUser.name || 'User').trim().split(/\s+/);
                const lastName = lastParts.join(' ') || firstName;
                n8nUser = this.userRepository.create({
                    email: email.toLowerCase(),
                    firstName: firstName || 'User',
                    lastName: lastName || '',
                    password: hashedPassword,
                    role: { slug: roleSlug },
                });
                n8nUser = await this.userRepository.save(n8nUser);
                n8nUser = await this.userRepository.findOne({
                    where: { id: n8nUser.id },
                    relations: ['authIdentities', 'role'],
                });
            } else if (n8nUser.password === null || n8nUser.password === undefined) {
                // User exists but has no password (invited user) — set bcrypt hash
                const bcrypt = require('bcryptjs');
                n8nUser.password = await bcrypt.hash(password, 10);
                await this.userRepository.save(n8nUser);
            }

            return n8nUser;
        } catch (portalError) {
            return undefined;
        }
    }
};
exports.EmailAuthHandler = EmailAuthHandler;
exports.EmailAuthHandler = EmailAuthHandler = __decorate([
    (0, decorators_1.AuthHandler)(),
    __metadata("design:paramtypes", [db_1.UserRepository,
        password_utility_1.PasswordUtility,
        event_service_1.EventService,
        config_1.GlobalConfig])
], EmailAuthHandler);
