const userSockets = new Map();
const activeGroupCalls = new Map();
const activeGroupCallMeta = new Map();
const activePrivateCalls = new Map();

module.exports = {
    userSockets,
    activeGroupCalls,
    activeGroupCallMeta,
    activePrivateCalls,
};
