module.exports = {
  apps: [
    {
      name: "recipe-plan-studio",
      cwd: __dirname,
      script: ".output/server/index.mjs",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        STORAGE_REQUIRE_PERSISTENT: "1",
        NITRO_PRESET: "node-server",
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      max_restarts: 10,
      restart_delay: 4000,
      min_uptime: "10s",
      exp_backoff_restart_delay: 4000,
    },
  ],
};
