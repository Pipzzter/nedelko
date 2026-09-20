// Keep provider diagnostics useful without exposing raw messages, input or credentials.
const codes = new Set([
  'credit_balance_exhausted', 'insufficient_quota', 'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded', 'organization_usage_limit_exceeded', 'rate_limit_exceeded',
  'slow_down', 'invalid_api_key', 'model_not_found', 'server_is_overloaded',
]);
const types = new Set(['insufficient_quota', 'rate_limit_error', 'invalid_request_error',
  'authentication_error', 'permission_error', 'server_error', 'service_unavailable_error']);

export function aiFailure(error) {
  const code = codes.has(error?.providerCode) ? error.providerCode : null;
  const type = types.has(error?.providerType) ? error.providerType : null;
  const httpStatus = Number.isInteger(error?.providerStatus) && error.providerStatus >= 400 && error.providerStatus <= 599 ? error.providerStatus : null;
  const requestId = typeof error?.providerRequestId === 'string' && /^req_[a-zA-Z0-9_-]{1,100}$/.test(error.providerRequestId) ? error.providerRequestId : null;
  let issue = 'ai_unavailable';
  if (['ai_incomplete', 'ai_refused', 'ai_invalid_output'].includes(error?.code)) issue = error.code;
  if (['invalid_curriculum', 'invalid_materials', 'invalid_text', 'both_languages'].includes(error?.code) ||
      ['missing_day_activities', 'missing_holiday_context', 'invalid_outdoor_order', 'missing_teacher_topic'].includes(error?.message)) issue = 'ai_invalid_output';
  if (code === 'credit_balance_exhausted') issue = 'ai_credits';
  else if (['organization_spend_limit_exceeded', 'project_spend_limit_exceeded'].includes(code)) issue = 'ai_spend_limit';
  else if (['insufficient_quota', 'organization_usage_limit_exceeded'].includes(code) || type === 'insufficient_quota') issue = 'ai_quota';
  else if (httpStatus === 401) issue = 'ai_auth';
  else if (httpStatus === 403) issue = 'ai_access';
  else if (httpStatus === 404 || code === 'model_not_found') issue = 'ai_model';
  else if (httpStatus === 429) issue = 'ai_rate_limit';
  else if (error?.name === 'TimeoutError') issue = 'ai_timeout';
  return { issue, details: { httpStatus, code, type, requestId } };
}
