import { Template, TemplateVersion, TemplateConfiguration, PredefinedStory, WorkflowRule, FormConfiguration } from '../../shared/types';
import { DatabaseConnection } from '../../shared/types';
import { NotFoundError, ValidationError, ApplicationError } from '../../shared/types';

export class TemplateService {
  constructor(private db: DatabaseConnection) {}

  async createTemplate(templateData: {
    name: string;
    description?: string;
    configuration: TemplateConfiguration;
    created_by: number;
  }): Promise<Template> {
    const { name, description, configuration, created_by } = templateData;

    // Validate configuration
    await this.validateTemplateConfiguration(configuration);

    const transaction = await this.db.beginTransaction();

    try {
      // Create template
      const templateQuery = `
        INSERT INTO templates (name, description, version, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, 1, true, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      const templateResult = await this.db.query(templateQuery, [name, description, created_by]);
      const templateId = templateResult.insertId;

      // Create initial version
      await this.createTemplateVersion({
        template_id: templateId,
        version_number: 1,
        configuration,
        changes_description: 'Initial template version',
        created_by
      });

      await transaction.commit();

      return await this.getTemplateById(templateId);

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getTemplateById(id: number, includeVersions = false): Promise<Template & { versions?: TemplateVersion[] }> {
    const query = `
      SELECT 
        t.*,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name
      FROM templates t
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE t.id = ? AND t.is_active = true
    `;

    const template = await this.db.queryFirst(query, [id]);

    if (!template) {
      throw new NotFoundError('Template', id);
    }

    if (includeVersions) {
      const versions = await this.getTemplateVersions(id);
      return { ...template, versions };
    }

    return template;
  }

  async getAllTemplates(filters?: {
    created_by?: number;
    search?: string;
  }): Promise<Template[]> {
    let query = `
      SELECT 
        t.*,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        (SELECT COUNT(*) FROM epics WHERE template_id = t.id) as usage_count
      FROM templates t
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE t.is_active = true
    `;

    const queryParams = [];

    if (filters?.created_by) {
      query += ' AND t.created_by = ?';
      queryParams.push(filters.created_by);
    }

    if (filters?.search) {
      query += ' AND (t.name LIKE ? OR t.description LIKE ?)';
      queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY t.created_at DESC';

    return await this.db.query(query, queryParams);
  }

  async updateTemplate(id: number, updates: {
    name?: string;
    description?: string;
    configuration?: TemplateConfiguration;
    changes_description?: string;
    updated_by: number;
  }): Promise<Template> {
    const existingTemplate = await this.getTemplateById(id);
    const { name, description, configuration, changes_description, updated_by } = updates;

    const transaction = await this.db.beginTransaction();

    try {
      // Update template basic info
      if (name || description) {
        const updateFields = [];
        const updateValues = [];

        if (name) {
          updateFields.push('name = ?');
          updateValues.push(name);
        }

        if (description !== undefined) {
          updateFields.push('description = ?');
          updateValues.push(description);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);

        const updateQuery = `UPDATE templates SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.db.query(updateQuery, updateValues);
      }

      // If configuration is updated, create new version
      if (configuration) {
        await this.validateTemplateConfiguration(configuration);

        const newVersionNumber = existingTemplate.version + 1;

        await this.createTemplateVersion({
          template_id: id,
          version_number: newVersionNumber,
          configuration,
          changes_description: changes_description || `Version ${newVersionNumber} update`,
          created_by: updated_by
        });

        // Update template version number
        await this.db.query(
          'UPDATE templates SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newVersionNumber, id]
        );
      }

      await transaction.commit();

      return await this.getTemplateById(id);

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteTemplate(id: number): Promise<void> {
    const template = await this.getTemplateById(id);

    // Check if template is being used by any epics
    const usageCount = await this.db.queryFirst(
      'SELECT COUNT(*) as count FROM epics WHERE template_id = ?',
      [id]
    );

    if (usageCount.count > 0) {
      throw new ValidationError(`Cannot delete template '${template.name}' as it is being used by ${usageCount.count} epic(s)`);
    }

    // Soft delete by setting is_active to false
    await this.db.query(
      'UPDATE templates SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  async duplicateTemplate(id: number, newName: string, created_by: number): Promise<Template> {
    const sourceTemplate = await this.getTemplateById(id);
    const latestVersion = await this.getLatestTemplateVersion(id);

    if (!latestVersion) {
      throw new NotFoundError('Template version for template', id);
    }

    return await this.createTemplate({
      name: newName,
      description: `Copy of ${sourceTemplate.description || sourceTemplate.name}`,
      configuration: latestVersion.configuration,
      created_by
    });
  }

  // Template Version Management
  async createTemplateVersion(versionData: {
    template_id: number;
    version_number: number;
    configuration: TemplateConfiguration;
    changes_description?: string;
    created_by: number;
  }): Promise<TemplateVersion> {
    const {
      template_id,
      version_number,
      configuration,
      changes_description,
      created_by
    } = versionData;

    // Validate template exists
    await this.getTemplateById(template_id);

    // Validate configuration
    await this.validateTemplateConfiguration(configuration);

    const query = `
      INSERT INTO template_versions (
        template_id, version_number, configuration, changes_description, 
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const result = await this.db.query(query, [
      template_id,
      version_number,
      JSON.stringify(configuration),
      changes_description,
      created_by
    ]);

    return await this.getTemplateVersionById(result.insertId);
  }

  async getTemplateVersionById(id: number): Promise<TemplateVersion> {
    const query = `
      SELECT 
        tv.*,
        t.name as template_name,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name
      FROM template_versions tv
      LEFT JOIN templates t ON tv.template_id = t.id
      LEFT JOIN users creator ON tv.created_by = creator.id
      WHERE tv.id = ?
    `;

    const version = await this.db.queryFirst(query, [id]);

    if (!version) {
      throw new NotFoundError('Template version', id);
    }

    // Parse configuration JSON
    version.configuration = JSON.parse(version.configuration);

    return version;
  }

  async getTemplateVersions(templateId: number): Promise<TemplateVersion[]> {
    const query = `
      SELECT 
        tv.*,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name
      FROM template_versions tv
      LEFT JOIN users creator ON tv.created_by = creator.id
      WHERE tv.template_id = ?
      ORDER BY tv.version_number DESC
    `;

    const versions = await this.db.query(query, [templateId]);

    return versions.map(version => ({
      ...version,
      configuration: JSON.parse(version.configuration)
    }));
  }

  async getLatestTemplateVersion(templateId: number): Promise<TemplateVersion | null> {
    const query = `
      SELECT 
        tv.*,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name
      FROM template_versions tv
      LEFT JOIN users creator ON tv.created_by = creator.id
      WHERE tv.template_id = ?
      ORDER BY tv.version_number DESC
      LIMIT 1
    `;

    const version = await this.db.queryFirst(query, [templateId]);

    if (!version) {
      return null;
    }

    version.configuration = JSON.parse(version.configuration);
    return version;
  }

  async revertToVersion(templateId: number, versionNumber: number, reverted_by: number): Promise<Template> {
    const template = await this.getTemplateById(templateId);
    
    const targetVersion = await this.db.queryFirst(
      'SELECT * FROM template_versions WHERE template_id = ? AND version_number = ?',
      [templateId, versionNumber]
    );

    if (!targetVersion) {
      throw new NotFoundError(`Template version ${versionNumber} for template`, templateId);
    }

    const configuration = JSON.parse(targetVersion.configuration);
    const newVersionNumber = template.version + 1;

    return await this.updateTemplate(templateId, {
      configuration,
      changes_description: `Reverted to version ${versionNumber}`,
      updated_by: reverted_by
    });
  }

  // Template Application
  async applyTemplateToEpic(templateId: number, epicId: number): Promise<void> {
    const latestVersion = await this.getLatestTemplateVersion(templateId);

    if (!latestVersion) {
      throw new NotFoundError('Template version for template', templateId);
    }

    const { configuration } = latestVersion;

    // This would be called by EpicService when creating an epic with a template
    // Implementation details are in EpicService.createStoriesFromTemplate
  }

  async getTemplatePreview(templateId: number): Promise<{
    template: Template;
    structure: {
      total_stories: number;
      total_tasks: number;
      total_subtasks: number;
      estimated_hours: number;
      phases_used: number[];
    };
  }> {
    const template = await this.getTemplateById(templateId);
    const latestVersion = await this.getLatestTemplateVersion(templateId);

    if (!latestVersion) {
      throw new NotFoundError('Template version for template', templateId);
    }

    const { configuration } = latestVersion;
    const structure = this.analyzeTemplateStructure(configuration);

    return {
      template,
      structure
    };
  }

  // Customer-specific template customization
  async createCustomerTemplateOverride(data: {
    template_id: number;
    customer_id: number;
    overrides: Partial<TemplateConfiguration>;
    created_by: number;
  }): Promise<void> {
    const { template_id, customer_id, overrides, created_by } = data;

    // Validate template and customer exist
    await this.getTemplateById(template_id);
    
    const customer = await this.db.queryFirst(
      'SELECT id FROM customers WHERE id = ? AND is_active = true',
      [customer_id]
    );

    if (!customer) {
      throw new NotFoundError('Customer', customer_id);
    }

    const query = `
      INSERT INTO customer_template_overrides (
        template_id, customer_id, overrides, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(template_id, customer_id) DO UPDATE SET
        overrides = excluded.overrides,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.db.query(query, [
      template_id,
      customer_id,
      JSON.stringify(overrides),
      created_by
    ]);
  }

  async getCustomerTemplateConfiguration(templateId: number, customerId: number): Promise<TemplateConfiguration> {
    const baseTemplate = await this.getLatestTemplateVersion(templateId);
    
    if (!baseTemplate) {
      throw new NotFoundError('Template version for template', templateId);
    }

    const override = await this.db.queryFirst(
      'SELECT overrides FROM customer_template_overrides WHERE template_id = ? AND customer_id = ?',
      [templateId, customerId]
    );

    if (!override) {
      return baseTemplate.configuration;
    }

    const overrides = JSON.parse(override.overrides);
    
    // Merge base configuration with customer overrides
    return this.mergeTemplateConfigurations(baseTemplate.configuration, overrides);
  }

  // Validation and Utilities
  private async validateTemplateConfiguration(configuration: TemplateConfiguration): Promise<void> {
    const errors: string[] = [];

    // Validate phases exist
    if (configuration.default_phases) {
      for (const phaseId of configuration.default_phases) {
        const phase = await this.db.queryFirst(
          'SELECT id FROM phases WHERE id = ? AND is_active = true',
          [phaseId]
        );
        if (!phase) {
          errors.push(`Phase with ID ${phaseId} does not exist`);
        }
      }
    }

    // Validate predefined stories structure
    if (configuration.predefined_stories) {
      for (const story of configuration.predefined_stories) {
        if (!story.title) {
          errors.push('All predefined stories must have a title');
        }

        if (story.phase_id) {
          const phase = await this.db.queryFirst(
            'SELECT id FROM phases WHERE id = ? AND is_active = true',
            [story.phase_id]
          );
          if (!phase) {
            errors.push(`Phase with ID ${story.phase_id} does not exist for story '${story.title}'`);
          }
        }
      }
    }

    // Validate workflow rules
    if (configuration.workflow_rules) {
      for (const rule of configuration.workflow_rules) {
        if (!rule.name || !rule.trigger || !rule.actions) {
          errors.push(`Workflow rule '${rule.name}' is missing required fields`);
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Template configuration validation failed', { validation_errors: errors });
    }
  }

  private analyzeTemplateStructure(configuration: TemplateConfiguration): {
    total_stories: number;
    total_tasks: number;
    total_subtasks: number;
    estimated_hours: number;
    phases_used: number[];
  } {
    let totalStories = 0;
    let totalTasks = 0;
    let totalSubtasks = 0;
    let estimatedHours = 0;
    const phasesUsed = new Set<number>();

    if (configuration.predefined_stories) {
      totalStories = configuration.predefined_stories.length;

      for (const story of configuration.predefined_stories) {
        if (story.phase_id) {
          phasesUsed.add(story.phase_id);
        }

        if (story.estimated_hours) {
          estimatedHours += story.estimated_hours;
        }

        if (story.predefined_tasks) {
          totalTasks += story.predefined_tasks.length;

          for (const task of story.predefined_tasks) {
            if (task.estimated_hours) {
              estimatedHours += task.estimated_hours;
            }

            if (task.predefined_subtasks) {
              totalSubtasks += task.predefined_subtasks.length;

              for (const subtask of task.predefined_subtasks) {
                if (subtask.estimated_hours) {
                  estimatedHours += subtask.estimated_hours;
                }
              }
            }
          }
        }
      }
    }

    return {
      total_stories: totalStories,
      total_tasks: totalTasks,
      total_subtasks: totalSubtasks,
      estimated_hours: estimatedHours,
      phases_used: Array.from(phasesUsed)
    };
  }

  private mergeTemplateConfigurations(
    base: TemplateConfiguration, 
    overrides: Partial<TemplateConfiguration>
  ): TemplateConfiguration {
    return {
      default_phases: overrides.default_phases || base.default_phases,
      predefined_stories: overrides.predefined_stories || base.predefined_stories,
      form_configurations: overrides.form_configurations || base.form_configurations,
      workflow_rules: overrides.workflow_rules || base.workflow_rules
    };
  }

  // Template Statistics and Analytics
  async getTemplateUsageStats(templateId: number): Promise<{
    total_epics: number;
    active_epics: number;
    completed_epics: number;
    success_rate: number;
    average_completion_time: number;
    most_common_customizations: any[];
  }> {
    const template = await this.getTemplateById(templateId);

    const usageStats = await this.db.queryFirst(`
      SELECT 
        COUNT(*) as total_epics,
        SUM(CASE WHEN status IN ('in_progress', 'not_started') THEN 1 ELSE 0 END) as active_epics,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_epics,
        AVG(CASE 
          WHEN status = 'completed' AND start_date IS NOT NULL AND end_date IS NOT NULL 
          THEN JULIANDAY(end_date) - JULIANDAY(start_date) 
          ELSE NULL 
        END) as avg_completion_days
      FROM epics 
      WHERE template_id = ?
    `, [templateId]);

    const successRate = usageStats.total_epics > 0 
      ? (usageStats.completed_epics / usageStats.total_epics) * 100 
      : 0;

    // Get most common customizations (would require customer_template_overrides table)
    const customizations = await this.db.query(`
      SELECT overrides, COUNT(*) as usage_count
      FROM customer_template_overrides 
      WHERE template_id = ?
      GROUP BY overrides
      ORDER BY usage_count DESC
      LIMIT 5
    `, [templateId]);

    return {
      total_epics: usageStats.total_epics || 0,
      active_epics: usageStats.active_epics || 0,
      completed_epics: usageStats.completed_epics || 0,
      success_rate: Math.round(successRate * 100) / 100,
      average_completion_time: Math.round((usageStats.avg_completion_days || 0) * 100) / 100,
      most_common_customizations: customizations.map(c => ({
        overrides: JSON.parse(c.overrides),
        usage_count: c.usage_count
      }))
    };
  }
}