/**
 * Java reference client oracle for real-cbserver integration tests.
 *
 * Sources: `conceptbase-cc-git/ProductPOOL/java/i5/cb/api/`
 * - LocalCBclient.java — IPC payloads (sendMessage)
 * - CBConnection.java — dual-socket notification (startNotifyingAbout*)
 * - CBShell.java — prolog / why shell commands
 */
export const JAVA_ORACLE = {
  /** LocalCBclient.getModulePath → GET_MODULE_PATH */
  getModulePath: "LocalCBclient.java#getModulePath",
  /** LocalCBclient.LPIcall → LPI_CALL with encoded goal string */
  lpiCall: "LocalCBclient.java#LPIcall",
  /** CBShell prolog → LPI_CALL `PROLOG_CALL,<goal>` */
  prolog: "CBShell.java#prolog",
  /** LocalCBclient.getErrorMessages → loop nextMessage(ERROR_REPORT) */
  why: "LocalCBclient.java#getErrorMessages",
  /** CBConnection.startNotifyingAbout(issue, notifConn) → notificationRequest(issue, notifConn.getClientId()) */
  notificationRequest: "CBConnection.java#startNotifyingAbout",
  /** CBConnection.stopNotifyingAbout → notificationRequest(`delete(${issue})`, ...) */
  notificationRequestDelete: "CBConnection.java#stopNotifyingAbout",
  /** CBConnection.startNotifyingAboutView(name, conn) → view(${name}) */
  notificationRequestView: "CBConnection.java#startNotifyingAboutView",
  /** LocalCBclient.getNotificationMessage */
  getNotificationMessage: "LocalCBclient.java#getNotificationMessage",
} as const;

/** CBShell: `LPIcall("PROLOG_CALL," + goal)` */
export function javaPrologLpiGoal(goal: string): string {
  const stripped = goal.trim().replace(/\.\s*$/, "");
  return `PROLOG_CALL,${stripped}`;
}

/** CBConnection.startNotifyingAboutView */
export function javaViewNotificationAbout(viewName: string): string {
  return `view(${viewName})`;
}

/** CBConnection.stopNotifyingAbout */
export function javaDeleteNotificationAbout(issue: string): string {
  return `delete(${issue})`;
}
