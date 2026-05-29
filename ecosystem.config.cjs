module.exports = {
  apps: [
    {
      name: "memduck",
      cwd: "/www/wwwroot/memduck",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        MEMDUCK_BASE_URL: "https://memduck.talkape.net",
        MEMDUCK_RUNTIME_DIR: "/www/wwwroot/memduck/.memduck/runtime",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3000",
        MEMDUCK_BASE_URL: "https://memduck.talkape.net",
        MEMDUCK_RUNTIME_DIR: "/www/wwwroot/memduck/.memduck/runtime",
      },
    },
  ],
};
