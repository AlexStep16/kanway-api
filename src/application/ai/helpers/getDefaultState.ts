import { AgentStateAnnotation } from '../agent/AgentStateAnnotation.ts'

export function getDefaultState(): typeof AgentStateAnnotation.State {
  return {
    messages: [],
    skiller_messages: [],

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

    final_response: '',
    chat_summary: '',
    planner_has_error: false,
    related_skill_names: [],
    skiller_has_error: false,

    tool_calls: [],
    pending_internal_tool_calls: [],
    internal_tool_call_results: [],
    internal_tool_calls_have_error: false,
  }
}
