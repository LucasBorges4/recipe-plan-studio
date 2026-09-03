module.exports = {
  apps: [{
    name: "recipe-plan-studio",
    cwd: __dirname,
    script: ".output/server/index.mjs",
    exec_mode: "fork",
    instances: 1,
    env: {
      NODE_ENV: "production",
      PORT: "3001",
      STORAGE_REQUIRE_PERSISTENT: "1",
    },
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
  }]
};
