import React, { useState, useEffect } from 'react';
import { FormConfiguration, FormField, FormFieldType, ValidationRule, ConditionalLogic, EntityType } from '../../shared/types';
import './FormBuilder.css';

interface FormBuilderProps {
  entityType: EntityType;
  onSave: (form: FormConfiguration) => void;
  onCancel: () => void;
  existingForm?: FormConfiguration;
}

interface FieldOption {
  value: string;
  label: string;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  entityType,
  onSave,
  onCancel,
  existingForm
}) => {
  const [formName, setFormName] = useState(existingForm?.name || '');
  const [formDescription, setFormDescription] = useState(existingForm?.description || '');
  const [fields, setFields] = useState<FormField[]>(existingForm?.fields || []);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const fieldTypes = [
    { value: FormFieldType.TEXT, label: 'Text Input' },
    { value: FormFieldType.TEXTAREA, label: 'Text Area' },
    { value: FormFieldType.EMAIL, label: 'Email' },
    { value: FormFieldType.NUMBER, label: 'Number' },
    { value: FormFieldType.DATE, label: 'Date' },
    { value: FormFieldType.DATETIME, label: 'Date & Time' },
    { value: FormFieldType.SELECT, label: 'Dropdown' },
    { value: FormFieldType.MULTISELECT, label: 'Multi-Select' },
    { value: FormFieldType.RADIO, label: 'Radio Buttons' },
    { value: FormFieldType.CHECKBOX, label: 'Checkbox' },
    { value: FormFieldType.FILE, label: 'File Upload' }
  ];

  const [currentField, setCurrentField] = useState<Partial<FormField>>({
    id: '',
    name: '',
    label: '',
    type: FormFieldType.TEXT,
    required: false,
    placeholder: '',
    help_text: '',
    options: [],
    validation_rules: [],
    conditional_logic: undefined
  });

  useEffect(() => {
    if (editingFieldIndex !== null) {
      setCurrentField(fields[editingFieldIndex]);
    }
  }, [editingFieldIndex, fields]);

  const addField = () => {
    setCurrentField({
      id: `field_${Date.now()}`,
      name: '',
      label: '',
      type: FormFieldType.TEXT,
      required: false,
      placeholder: '',
      help_text: '',
      options: [],
      validation_rules: [],
      conditional_logic: undefined
    });
    setEditingFieldIndex(null);
    setShowFieldModal(true);
  };

  const editField = (index: number) => {
    setEditingFieldIndex(index);
    setShowFieldModal(true);
  };

  const saveField = () => {
    if (!currentField.name || !currentField.label) {
      alert('Field name and label are required');
      return;
    }

    const fieldToSave: FormField = {
      id: currentField.id || `field_${Date.now()}`,
      name: currentField.name!,
      label: currentField.label!,
      type: currentField.type!,
      required: currentField.required || false,
      placeholder: currentField.placeholder,
      help_text: currentField.help_text,
      options: currentField.options || [],
      validation_rules: currentField.validation_rules || [],
      conditional_logic: currentField.conditional_logic
    };

    if (editingFieldIndex !== null) {
      const updatedFields = [...fields];
      updatedFields[editingFieldIndex] = fieldToSave;
      setFields(updatedFields);
    } else {
      setFields([...fields, fieldToSave]);
    }

    setShowFieldModal(false);
    setEditingFieldIndex(null);
    setCurrentField({
      id: '',
      name: '',
      label: '',
      type: FormFieldType.TEXT,
      required: false,
      placeholder: '',
      help_text: '',
      options: [],
      validation_rules: [],
      conditional_logic: undefined
    });
  };

  const deleteField = (index: number) => {
    if (confirm('Are you sure you want to delete this field?')) {
      const updatedFields = fields.filter((_, i) => i !== index);
      setFields(updatedFields);
    }
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    const updatedFields = [...fields];
    const [movedField] = updatedFields.splice(fromIndex, 1);
    updatedFields.splice(toIndex, 0, movedField);
    setFields(updatedFields);
  };

  const handleDragStart = (index: number) => {
    setDraggedFieldIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedFieldIndex !== null && draggedFieldIndex !== dropIndex) {
      moveField(draggedFieldIndex, dropIndex);
    }
    setDraggedFieldIndex(null);
  };

  const addFieldOption = () => {
    const newOptions = [...(currentField.options || []), { value: '', label: '' }];
    setCurrentField({ ...currentField, options: newOptions });
  };

  const updateFieldOption = (index: number, field: 'value' | 'label', value: string) => {
    const updatedOptions = [...(currentField.options || [])];
    updatedOptions[index] = { ...updatedOptions[index], [field]: value };
    setCurrentField({ ...currentField, options: updatedOptions });
  };

  const removeFieldOption = (index: number) => {
    const updatedOptions = (currentField.options || []).filter((_, i) => i !== index);
    setCurrentField({ ...currentField, options: updatedOptions });
  };

  const addValidationRule = () => {
    const newRules = [...(currentField.validation_rules || []), { type: 'min', message: '', min: 0 }];
    setCurrentField({ ...currentField, validation_rules: newRules });
  };

  const updateValidationRule = (index: number, rule: Partial<ValidationRule>) => {
    const updatedRules = [...(currentField.validation_rules || [])];
    updatedRules[index] = { ...updatedRules[index], ...rule };
    setCurrentField({ ...currentField, validation_rules: updatedRules });
  };

  const removeValidationRule = (index: number) => {
    const updatedRules = (currentField.validation_rules || []).filter((_, i) => i !== index);
    setCurrentField({ ...currentField, validation_rules: updatedRules });
  };

  const handleSave = () => {
    if (!formName.trim()) {
      alert('Form name is required');
      return;
    }

    if (fields.length === 0) {
      alert('At least one field is required');
      return;
    }

    const form: FormConfiguration = {
      id: existingForm?.id || 0,
      name: formName,
      description: formDescription,
      entity_type: entityType,
      fields,
      is_active: true,
      created_by: 1 // This would come from auth context
    };

    onSave(form);
  };

  const needsOptions = (fieldType: FormFieldType) => {
    return [FormFieldType.SELECT, FormFieldType.MULTISELECT, FormFieldType.RADIO].includes(fieldType);
  };

  return (
    <div className="form-builder">
      <div className="form-builder-header">
        <div className="header-controls">
          <h2>{existingForm ? 'Edit Form' : 'Create New Form'}</h2>
          <div className="header-actions">
            <button 
              className={`btn btn-secondary ${previewMode ? 'active' : ''}`}
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? 'Edit Mode' : 'Preview'}
            </button>
            <button className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save Form
            </button>
          </div>
        </div>

        <div className="form-meta">
          <div className="form-group">
            <label>Form Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Enter form name"
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional form description"
              className="form-control"
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="form-builder-content">
        {previewMode ? (
          <div className="form-preview">
            <h3>Form Preview</h3>
            <div className="preview-form">
              {fields.map((field, index) => (
                <div key={field.id} className="preview-field">
                  <label className={field.required ? 'required' : ''}>
                    {field.label}
                    {field.required && <span className="required-asterisk">*</span>}
                  </label>
                  {field.help_text && (
                    <div className="help-text">{field.help_text}</div>
                  )}
                  <div className="field-preview">
                    {field.type === FormFieldType.TEXT && (
                      <input type="text" placeholder={field.placeholder} disabled />
                    )}
                    {field.type === FormFieldType.TEXTAREA && (
                      <textarea placeholder={field.placeholder} disabled />
                    )}
                    {field.type === FormFieldType.EMAIL && (
                      <input type="email" placeholder={field.placeholder} disabled />
                    )}
                    {field.type === FormFieldType.NUMBER && (
                      <input type="number" placeholder={field.placeholder} disabled />
                    )}
                    {field.type === FormFieldType.DATE && (
                      <input type="date" disabled />
                    )}
                    {field.type === FormFieldType.DATETIME && (
                      <input type="datetime-local" disabled />
                    )}
                    {field.type === FormFieldType.SELECT && (
                      <select disabled>
                        <option>Select an option...</option>
                        {field.options?.map((option, i) => (
                          <option key={i} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    )}
                    {field.type === FormFieldType.RADIO && (
                      <div className="radio-group">
                        {field.options?.map((option, i) => (
                          <label key={i} className="radio-option">
                            <input type="radio" name={field.name} value={option.value} disabled />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    )}
                    {field.type === FormFieldType.CHECKBOX && (
                      <label className="checkbox-option">
                        <input type="checkbox" disabled />
                        {field.placeholder || 'Checkbox option'}
                      </label>
                    )}
                    {field.type === FormFieldType.FILE && (
                      <input type="file" disabled />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="form-builder-workspace">
            <div className="fields-panel">
              <div className="panel-header">
                <h3>Form Fields</h3>
                <button className="btn btn-primary btn-sm" onClick={addField}>
                  Add Field
                </button>
              </div>

              <div className="fields-list">
                {fields.length === 0 ? (
                  <div className="empty-state">
                    <p>No fields added yet. Click "Add Field" to get started.</p>
                  </div>
                ) : (
                  fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="field-item"
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                    >
                      <div className="field-header">
                        <div className="field-info">
                          <span className="field-label">{field.label}</span>
                          <span className="field-type">{field.type}</span>
                          {field.required && <span className="required-badge">Required</span>}
                        </div>
                        <div className="field-actions">
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => editField(index)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => deleteField(index)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Field Modal */}
      {showFieldModal && (
        <div className="modal-overlay">
          <div className="modal-content field-modal">
            <div className="modal-header">
              <h3>{editingFieldIndex !== null ? 'Edit Field' : 'Add New Field'}</h3>
              <button
                className="modal-close"
                onClick={() => setShowFieldModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Field Name</label>
                  <input
                    type="text"
                    value={currentField.name || ''}
                    onChange={(e) => setCurrentField({ ...currentField, name: e.target.value })}
                    placeholder="field_name (no spaces)"
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Field Label</label>
                  <input
                    type="text"
                    value={currentField.label || ''}
                    onChange={(e) => setCurrentField({ ...currentField, label: e.target.value })}
                    placeholder="Display label"
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Field Type</label>
                  <select
                    value={currentField.type}
                    onChange={(e) => setCurrentField({ ...currentField, type: e.target.value as FormFieldType })}
                    className="form-control"
                  >
                    {fieldTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={currentField.required || false}
                      onChange={(e) => setCurrentField({ ...currentField, required: e.target.checked })}
                    />
                    Required Field
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Placeholder Text</label>
                <input
                  type="text"
                  value={currentField.placeholder || ''}
                  onChange={(e) => setCurrentField({ ...currentField, placeholder: e.target.value })}
                  placeholder="Placeholder text"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Help Text</label>
                <textarea
                  value={currentField.help_text || ''}
                  onChange={(e) => setCurrentField({ ...currentField, help_text: e.target.value })}
                  placeholder="Optional help text"
                  className="form-control"
                  rows={2}
                />
              </div>

              {/* Options for select, radio, multiselect */}
              {needsOptions(currentField.type!) && (
                <div className="form-group">
                  <label>Options</label>
                  <div className="options-list">
                    {(currentField.options || []).map((option, index) => (
                      <div key={index} className="option-item">
                        <input
                          type="text"
                          value={option.value}
                          onChange={(e) => updateFieldOption(index, 'value', e.target.value)}
                          placeholder="Value"
                          className="form-control option-input"
                        />
                        <input
                          type="text"
                          value={option.label}
                          onChange={(e) => updateFieldOption(index, 'label', e.target.value)}
                          placeholder="Label"
                          className="form-control option-input"
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => removeFieldOption(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={addFieldOption}
                    >
                      Add Option
                    </button>
                  </div>
                </div>
              )}

              {/* Validation Rules */}
              <div className="form-group">
                <label>Validation Rules</label>
                <div className="validation-rules">
                  {(currentField.validation_rules || []).map((rule, index) => (
                    <div key={index} className="validation-rule">
                      <select
                        value={rule.type}
                        onChange={(e) => updateValidationRule(index, { type: e.target.value as any })}
                        className="form-control"
                      >
                        <option value="min">Minimum</option>
                        <option value="max">Maximum</option>
                        <option value="pattern">Pattern</option>
                      </select>
                      {(rule.type === 'min' || rule.type === 'max') && (
                        <input
                          type="number"
                          value={rule.min || rule.max || 0}
                          onChange={(e) => updateValidationRule(index, 
                            rule.type === 'min' 
                              ? { min: parseInt(e.target.value) }
                              : { max: parseInt(e.target.value) }
                          )}
                          className="form-control"
                        />
                      )}
                      <input
                        type="text"
                        value={rule.message}
                        onChange={(e) => updateValidationRule(index, { message: e.target.value })}
                        placeholder="Error message"
                        className="form-control"
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => removeValidationRule(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={addValidationRule}
                  >
                    Add Validation
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowFieldModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveField}
              >
                Save Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormBuilder;