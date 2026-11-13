import { definePlugin } from "nitro";

// Stands for an app that releases resources (child processes, DB handles, open sockets) on shutdown.
export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("close", () => {
    console.log("[repro] close hook ran");
  });
});
