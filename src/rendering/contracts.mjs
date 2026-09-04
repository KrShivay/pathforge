/**
 * @typedef {'layout' | 'pagination' | 'typography' | 'renderer-version' | 'other'} UnresolvedInputCategory
 */

/**
 * @typedef {{
 *   input_id: string,
 *   category: UnresolvedInputCategory,
 *   status: 'UNKNOWN' | 'ASSUMPTION',
 *   reason: string,
 *   reference?: string
 * }} UnresolvedRenderInput
 */

/**
 * @typedef {{
 *   field_id: string,
 *   semantic_role: string
 * }} DocumentFieldConfig
 */

/**
 * @typedef {{
 *   section_id: string,
 *   semantic_role: string,
 *   heading?: string,
 *   fields: DocumentFieldConfig[]
 * }} DocumentSectionConfig
 */

/**
 * Explicit semantic mapping supplied to the presentation-neutral model builder.
 * Layout, font, and pagination choices are intentionally not part of this type.
 * @typedef {{
 *   config_id: string,
 *   config_version: string,
 *   locale: string,
 *   sections: DocumentSectionConfig[],
 *   unresolved_inputs: UnresolvedRenderInput[]
 * }} DocumentModelConfig
 */

/**
 * @typedef {{
 *   field_id: string,
 *   semantic_role: string,
 *   content: Record<string, import('../domain/contracts.mjs').JsonValue>,
 *   provenance: {
 *     source_catalog_version: string,
 *     option_id?: string
 *   }
 * }} DocumentField
 */

/**
 * @typedef {{
 *   section_id: string,
 *   semantic_role: string,
 *   heading?: string,
 *   fields: DocumentField[]
 * }} DocumentSection
 */

/**
 * Immutable input to a future formatter/PDF renderer. It contains semantic
 * structure and frozen clinical snapshots, but no coordinates or styling.
 * @typedef {{
 *   model_schema: 'pathforge.report-document/v1',
 *   report_version: import('../domain/contracts.mjs').ReportVersionIdentity,
 *   issue: {number: string, date: string},
 *   lineage: {supersedes: import('../domain/contracts.mjs').ReportVersionIdentity | null},
 *   provenance: {
 *     source_catalog_version: string,
 *     finalized_at?: string,
 *     finalized_by?: string,
 *     amended_at?: string,
 *     amended_by?: string
 *   },
 *   render_configuration: {
 *     config_id: string,
 *     config_version: string,
 *     locale: string,
 *     unresolved_inputs: UnresolvedRenderInput[]
 *   },
 *   sections: DocumentSection[]
 * }} ReportDocumentModel
 */

export const DOCUMENT_MODEL_SCHEMA = 'pathforge.report-document/v1';
