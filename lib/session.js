// How long a session lasts with no activity. Every authenticated request
// resets this, so it's an idle timeout, not a fixed time since login.
export const SESSION_MAX_AGE = 60 * 15; // 5 minutes