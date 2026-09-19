interface VerifierEnv {
  AUNO_APP_ORIGIN: string;
  AUNO_VERIFIER_TOKEN: string;
}

const verifierWorker = {
  async scheduled(_controller: ScheduledController, env: VerifierEnv, ctx: ExecutionContext) {
    const request = fetch(`${env.AUNO_APP_ORIGIN}/api/internal/verify`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.AUNO_VERIFIER_TOKEN}` },
    }).then((response) => {
      if (!response.ok) throw new Error(`Verifier endpoint returned ${response.status}.`);
    });
    ctx.waitUntil(request);
  },
};

export default verifierWorker;
