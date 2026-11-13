import { defineWebSocketHandler } from "nitro";

export default defineWebSocketHandler({
  open(peer) {
    console.log("[repro] ws open", peer.id);
  },
  close(peer, details) {
    console.log("[repro] ws close", peer.id, details.code);
  },
});
