/**
 * Combinations of settings that leave a deployment unable to do what it was configured for.
 *
 * THE CATCH-22 THIS EXISTS FOR. `system.lichessConfig` is the only place this product names which
 * server-side pieces are absent, and it is a `protectedProcedure` -- correctly, because those
 * names describe the deployment and do not belong on an open URL. Reaching it needs a session;
 * creating a session needs `JWT_SECRET`. So on a deployment missing `JWT_SECRET`, the report that
 * would say `JWT_SECRET` is missing is the one thing that cannot be reached. What the operator
 * sees is a sign-in button that appears to do nothing, a health check answering 200, and no
 * mention of the variable anywhere.
 *
 * COMBINATIONS, NOT PRESENCE. `lichessConfig` already lists five booleans and that is not what is
 * missing. What no single flag can show is that a SET of values is incoherent: an owner who can
 * never sign in, a database no account can ever reach. Each variable is present or absent exactly
 * as intended and the deployment still cannot work.
 *
 * AN EMPTY DEPLOYMENT IS NOT A FAULT. Nothing configured is the supported browser-local product
 * running as designed. Reporting that as a misconfiguration would train an operator to ignore the
 * report, which is the only way a report like this fails.
 *
 * THE CHANNEL IS THE SERVER LOG. Naming variables on a public route would move the report
 * `ownerProcedure` deliberately keeps private onto the open internet -- the same reason
 * `/api/health` is one boolean. The operator has the logs; nobody else does.
 */
export type DeploymentEnv = {
  jwtSecret: string;
  oAuthServerUrl: string;
  ownerOpenId: string;
  databaseUrl: string;
};

export type ConfigurationFault = {
  /** Stable identifier, so a log line can be grepped for and a test can name one. */
  code: "owner-without-session" | "session-without-oauth" | "database-without-owner";
  /** The variables involved, by NAME. Never a value: a secret in a log is still a secret. */
  variables: string[];
  /** What the deployment cannot do. The part no single presence flag could show. */
  consequence: string;
};

export function configurationFaults(env: DeploymentEnv): ConfigurationFault[] {
  const faults: ConfigurationFault[] = [];
  const has = (value: string) => value.trim().length > 0;

  if (has(env.ownerOpenId) && !has(env.jwtSecret)) {
    faults.push({
      code: "owner-without-session",
      variables: ["OWNER_OPEN_ID", "JWT_SECRET"],
      consequence:
        "הוגדר חשבון בעלים, אבל בלי JWT_SECRET אי אפשר להחזיק סשן בכלל — אף חשבון לא יעבור את השער, וההתחברות תיכשל בשקט. גם דוח ההגדרות עצמו נמצא מאחורי אותו שער.",
    });
  }

  if (has(env.jwtSecret) && !has(env.oAuthServerUrl)) {
    faults.push({
      code: "session-without-oauth",
      variables: ["JWT_SECRET", "OAUTH_SERVER_URL"],
      consequence:
        "אפשר לאמת סשן אבל אי אפשר להתחיל אחד: בלי OAUTH_SERVER_URL אין למי להחליף את קוד ההתחברות, וה-callback ייפול.",
    });
  }

  /*
   * Reported only on a deployment that was otherwise configured for sign-in. A database beside an
   * empty environment is half-built rather than incoherent, and `owner-without-session` above
   * would already be describing the same missing decision.
   */
  if (has(env.databaseUrl) && !has(env.ownerOpenId) && has(env.jwtSecret)) {
    faults.push({
      code: "database-without-owner",
      variables: ["DATABASE_URL", "OWNER_OPEN_ID"],
      consequence:
        "יש מסד נתונים, אבל בלי OWNER_OPEN_ID השער מסרב לכל חשבון — הרשומה תישאר בדפדפן והמסד לא ייכתב אליו אף פעם. שום דבר לא נכשל, זה פשוט לא קורה.",
    });
  }

  return faults;
}
