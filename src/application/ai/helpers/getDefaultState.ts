import { AgentStateAnnotation } from '../agent/AgentStateAnnotation.ts'

export function getDefaultState(): typeof AgentStateAnnotation.State {
  return {
    messages: [],
    skiller_messages: [],
    brain_messages: [],

    coder_messages: [],
    coder_has_error: false,
    coder_has_confirmations: false,
    coder_ambiguities: null,
    coder_has_ambiguities: false,
    coder_code: '',
    execution_output: '',
    resolved_ambiguities: {},

    final_response: '',
    chat_summary: '',
    enriched_message: '',
    brain_has_error: false,
    related_skill_names: [],
    skiller_has_error: false,

    tool_calls: [],
    pending_internal_tool_calls: [],
    internal_tool_call_results: [],
    internal_tool_calls_have_error: false,
  }
}
