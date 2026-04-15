import { AgentStateAnnotation } from '../agent/AgentStateAnnotation.js'

export function getDefaultState(): typeof AgentStateAnnotation.State {
  return {
    messages: [],
    final_messages: [],

    coder_messages: [],
    coder_has_error: false,
    coder_has_confirmations: false,
    coder_ambiguities: null,
    coder_has_ambiguities: false,
    coder_code: '',
    coder_errors: [],
    coder_steps_count: 0,
    planner_steps_count: 0,
    resolved_ambiguities: {},
    current_plan: [],
    planner_messages: [],
    coder_iterations: 0,

    planner_has_error: false,
    current_payload: {},
    last_planner_tool_name: '',

    tool_calls: [],
    pending_internal_tool_calls: [],
    internal_tool_call_results: [],
    internal_tool_calls_have_error: false,
  }
}
