/**
 * Phase 2 Autonomy System - MaxSam V4
 *
 * IMPORTANT: This module is DESIGNED but NOT ACTIVATED.
 * All autonomous operations are gated by the autonomy_enabled flag.
 *
 * To enable Phase 2 autonomy:
 * 1. Execute the database migration
 * 2. Set system_config.autonomy_enabled = 'true'
 * 3. Set system_config.phase2_active = 'true'
 *
 * WARNING: Do not enable without explicit authorization.
 */

// Feature flags and authorization
export {
  getAutonomyFlags,
  canExecuteAutonomously,
  isPhase2Active,
  isDryRunMode,
  enablePhase2,
  disablePhase2,
  setDryRunMode,
  shouldSelfPause,
  executeSelfPause,
  getActionThresholds,
  ACTION_AUTONOMY_REQUIREMENTS,
  type AutonomyFlags,
  type AutonomyCheckResult,
  type ActionThreshold,
} from './flags';

// Validators
export {
  runFullValidation,
  validateActionRecorded,
  validateSmsDelivery,
  canRollback,
  type ValidatorResult,
  type ValidationContext,
  type FullValidationResult,
} from './validators';
