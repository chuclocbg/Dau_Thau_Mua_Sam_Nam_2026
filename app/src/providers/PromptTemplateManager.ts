/**
 * P6-10L: PromptTemplateManager — reusable prompt templates with variable substitution.
 *
 * Templates contain {{variableName}} placeholders.  Each variable is declared
 * in the template's `variables` array with an optional defaultValue and a
 * `required` flag.
 *
 * render() algorithm:
 *   1. Resolve each variable:  provided value → defaultValue → '' (empty).
 *   2. Collect names of required variables that had neither a provided value
 *      nor a defaultValue → missingVariables.
 *   3. Replace every {{name}} occurrence in the template (global regex).
 *   4. Return ok:true + rendered when missingVariables is empty;
 *      ok:false + partial rendered otherwise.
 *
 * Undeclared {{vars}} that appear in the template body are replaced with ''.
 *
 * All public methods are synchronous.  Never throws.
 * Defensive copies: every read / render result returns an independent snapshot.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptVariable {
  name:          string;
  description?:  string;
  /** When true the caller must supply a value (or define a defaultValue). */
  required:      boolean;
  /** Value used when the caller supplies no value for this variable. */
  defaultValue?: string;
}

export interface PromptTemplate {
  id:           string;
  name:         string;
  description?: string;
  /** Template body containing {{variableName}} placeholders. */
  template:     string;
  variables:    PromptVariable[];
}

export interface PromptRenderOptions {
  /** Caller-supplied values keyed by variable name. */
  variables?: Record<string, string>;
}

export interface PromptRenderResult {
  /** True when all required variables were resolved. */
  ok:               boolean;
  /** Fully or partially rendered prompt (missing required vars become ''). */
  rendered:         string;
  /**
   * Names of required variables that had no provided value and no defaultValue.
   * Empty on success.
   */
  missingVariables: string[];
}

// ─── PromptTemplateManager ────────────────────────────────────────────────────

export class PromptTemplateManager {
  private readonly registry: Map<string, PromptTemplate> = new Map();

  /**
   * Registers (or overwrites) a template.
   * Stores a defensive copy so callers cannot mutate registry state.
   */
  registerTemplate(template: PromptTemplate): void {
    this.registry.set(template.id, cloneTemplate(template));
  }

  /**
   * Removes a template by id.
   * Returns true when found and removed, false otherwise.
   */
  removeTemplate(id: string): boolean {
    return this.registry.delete(id);
  }

  /**
   * Returns a defensive copy of the template, or undefined if not registered.
   */
  getTemplate(id: string): PromptTemplate | undefined {
    const t = this.registry.get(id);
    return t ? cloneTemplate(t) : undefined;
  }

  /** Returns defensive copies of all registered templates in insertion order. */
  listTemplates(): PromptTemplate[] {
    return Array.from(this.registry.values()).map(cloneTemplate);
  }

  /**
   * Renders a template by substituting {{variable}} placeholders.
   *
   * Resolution order per placeholder:
   *   1. options.variables[name]  (caller-supplied)
   *   2. variable.defaultValue    (declared default)
   *   3. ''                       (empty — required vars also counted as missing)
   *
   * Returns ok:false (never throws) when:
   *   - The template id is not registered.
   *   - One or more required variables have no resolved value.
   */
  render(id: string, options: PromptRenderOptions = {}): PromptRenderResult {
    const tmpl = this.registry.get(id);
    if (!tmpl) {
      return { ok: false, rendered: '', missingVariables: [] };
    }

    const provided = options.variables ?? {};
    const subs     = new Map<string, string>();
    const missing: string[] = [];

    // Build substitution map from declared variables.
    for (const v of tmpl.variables) {
      if (Object.prototype.hasOwnProperty.call(provided, v.name)) {
        subs.set(v.name, provided[v.name]!);
      } else if (v.defaultValue !== undefined) {
        subs.set(v.name, v.defaultValue);
      } else {
        if (v.required) missing.push(v.name);
        subs.set(v.name, '');
      }
    }

    // Replace all {{varName}} occurrences (including undeclared ones → '').
    const rendered = tmpl.template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
      subs.has(name) ? subs.get(name)! : '',
    );

    if (missing.length > 0) {
      return { ok: false, rendered, missingVariables: [...missing] };
    }

    return { ok: true, rendered, missingVariables: [] };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function cloneVariable(v: PromptVariable): PromptVariable {
  const copy: PromptVariable = { name: v.name, required: v.required };
  if (v.description  !== undefined) copy.description  = v.description;
  if (v.defaultValue !== undefined) copy.defaultValue = v.defaultValue;
  return copy;
}

function cloneTemplate(t: PromptTemplate): PromptTemplate {
  const copy: PromptTemplate = {
    id:        t.id,
    name:      t.name,
    template:  t.template,
    variables: t.variables.map(cloneVariable),
  };
  if (t.description !== undefined) copy.description = t.description;
  return copy;
}
