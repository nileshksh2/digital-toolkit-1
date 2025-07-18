import { Phase } from '../types';

export const DEFAULT_PHASES: Omit<Phase, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Design',
    sequence_order: 1,
    description: 'Project design and planning phase where requirements are gathered and system architecture is defined',
    is_active: true
  },
  {
    name: 'Configuration',
    sequence_order: 2,
    description: 'System configuration and setup phase where the solution is built and configured according to specifications',
    is_active: true
  },
  {
    name: 'Testing',
    sequence_order: 3,
    description: 'Testing and quality assurance phase where the system is thoroughly tested for functionality and performance',
    is_active: true
  },
  {
    name: 'Promotion',
    sequence_order: 4,
    description: 'Production deployment and go-live phase where the system is deployed to production and users are onboarded',
    is_active: true
  }
];

export const PHASE_SEQUENCE = {
  DESIGN: 1,
  CONFIGURATION: 2,
  TESTING: 3,
  PROMOTION: 4
} as const;

export const PHASE_NAMES = {
  1: 'Design',
  2: 'Configuration',
  3: 'Testing',
  4: 'Promotion'
} as const;

export const VALID_PHASE_TRANSITIONS = {
  1: [2], // Design can go to Configuration
  2: [3], // Configuration can go to Testing
  3: [4], // Testing can go to Promotion
  4: []   // Promotion is final
} as const;

export const PHASE_COLORS = {
  1: '#3B82F6', // Blue for Design
  2: '#F59E0B', // Amber for Configuration
  3: '#EF4444', // Red for Testing
  4: '#10B981'  // Green for Promotion
} as const;

export const PHASE_ICONS = {
  1: 'design',
  2: 'settings',
  3: 'bug-report',
  4: 'rocket-launch'
} as const;