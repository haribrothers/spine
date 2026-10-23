/** A refusal or error from one of Spine's own routes, in the route's words (US-MCP-05). */
export class AgentCallError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
