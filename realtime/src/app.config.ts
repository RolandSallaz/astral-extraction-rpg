import {
    defineServer,
    defineRoom,
    monitor,
    playground,
} from "colyseus";

import { MyRoom } from "./rooms/MyRoom.js";
import { RaidRoom } from "./rooms/RaidRoom.js";

export function createAppConfig() {
    return defineServer({
        rooms: {
            world: defineRoom(MyRoom).filterBy(["worldOwner"]),
            raid: defineRoom(RaidRoom).filterBy(["raidRunId"]),
        },

        express: (app) => {
            app.use("/monitor", monitor());

            if (process.env.NODE_ENV !== "production") {
                app.use("/", playground());
            }
        }

    });
}

const server = createAppConfig();

export default server;
