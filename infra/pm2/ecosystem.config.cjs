module.exports = {
  apps: [{
    name: "sovegent-identity-api",
    cwd: "/var/www/sovegent-identity/api",
    script: "dist/index.js",
    interpreter: "node",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "256M",
    env: { NODE_ENV: "production", PORT: 3000, HOST: "127.0.0.1" },
    env_file: "/var/www/sovegent-identity/api/.env",
    error_file: "/var/log/pm2/sovegent-identity-api-error.log",
    out_file: "/var/log/pm2/sovegent-identity-api-out.log",
  }],
};
