import { AgentStateAnnotation } from '../agent/AgentStateAnnotation.ts'

export function getDefaultState(): typeof AgentStateAnnotation.State {
  return {
    messages: [],

    coder_messages: [],
    coder_has_error: false,
    coder_has_confirmations: false,
    coder_ambiguities: null,
    coder_has_ambiguities: false,
    coder_code: '',
    resolved_ambiguities: {},
    current_step_index: 0,
    last_replanner_tool_name: '',
    replanner_has_error: false,
    replanner_messages: [],
    current_plan: [],
    planner_messages: [],
    last_execution_messages: [],
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
