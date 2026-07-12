/**
 * The `ResourceAssignment.resourceType` convention for a form/report (§12)
 * attached to a scope — `resourceKey` is a `DynamicModuleDefinition.id`.
 * Distinct from the existing "module" convention (a whole feature surface
 * attached to a scope, e.g. Departments), so only THIS resourceType
 * triggers the "you have a new form" notification fan-out
 * (`FormAssignmentNotifier`). Lives in its own file (not inside
 * `resource-assignments.service.ts`) so both that service and
 * `BranchesService` can import the bare constant without either depending
 * on the other's module.
 */
export const FORM_RESOURCE_TYPE = 'dynamic_module_definition';
