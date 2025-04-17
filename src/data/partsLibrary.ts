import type { PartDefinition } from '../types';

// Initial parts library with placeholder data
// Replace modelPaths with actual paths when available
export const initialPartsLibrary: PartDefinition[] = [
  // Heads
  {
    id: 'head_placeholder_a',
    name: 'Placeholder Head A',
    type: 'head',
    modelPath: '/assets/models/placeholder_head.gltf', // Use absolute path from public
    rarity: 'common',
    tags: ['Basic', 'Metal'],
  },
  {
    id: 'head_placeholder_b',
    name: 'Placeholder Head B',
    type: 'head',
    modelPath: '/assets/models/placeholder_head_b.gltf', // Use absolute path from public
    rarity: 'common',
    tags: ['Rounded'],
  },
  // Torsos
  {
    id: 'torso_placeholder_a',
    name: 'Placeholder Torso A',
    type: 'torso',
    modelPath: '/assets/models/placeholder_torso.gltf', // Use absolute path from public
    rarity: 'common',
    tags: ['Boxy', 'Metal'],
  },
  {
    id: 'torso_placeholder_b',
    name: 'Placeholder Torso B',
    type: 'torso',
    modelPath: '/assets/models/placeholder_torso_b.gltf', // Use absolute path from public
    rarity: 'common',
    tags: ['Cylinder'],
  },
  // Arms
  {
    id: 'arms_placeholder_a',
    name: 'Placeholder Arms A',
    type: 'arms',
    modelPath: '/assets/models/placeholder_arms.gltf', // Use absolute path from public
    rarity: 'common',
    tags: ['Simple', 'Jointed'],
  },
  {
    id: 'arms_placeholder_b',
    name: 'Placeholder Arms B',
    type: 'arms',
    modelPath: '/assets/models/placeholder_arms_b.gltf', // Use absolute path from public
    rarity: 'common',
    tags: ['Pincer'],
  },
  // Legs
  {
    id: 'legs_placeholder_a',
    name: 'Placeholder Legs A',
    type: 'legs',
    modelPath: '/assets/models/placeholder_legs.gltf', // Use absolute path from public
    rarity: 'common',
    tags: ['Standard', 'Bipedal'],
  },
  {
    id: 'legs_placeholder_b',
    name: 'Placeholder Legs B',
    type: 'legs',
    modelPath: '/assets/models/placeholder_legs_b.gltf', // Use absolute path from public
    rarity: 'common',
    tags: ['Wheeled'],
  },
  // Add more parts here as they are created...
];

// Helper function to get a part definition by ID
export const getPartById = (id: string): PartDefinition | undefined => {
  return initialPartsLibrary.find(part => part.id === id);
};

// Helper function to get parts by type
export const getPartsByType = (type: PartDefinition['type']): PartDefinition[] => {
  return initialPartsLibrary.filter(part => part.type === type);
};