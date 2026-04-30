/**
 * lib/avatar-video/types.ts
 *
 * Shared avatar profile DTO used by Influencer IA.
 *
 * Note: this file used to contain wizard-related DTOs (CreationDTO,
 * VideoScenarioDTO, ConceptDTO, PromptDTO, etc.) but those were removed
 * along with the avatar-video wizard. Only the AvatarProfile DTO remains
 * because Influencer IA reuses the AvatarProfile model.
 */

export interface AvatarProfileDTO {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}
