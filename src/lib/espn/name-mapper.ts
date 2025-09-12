// Robust name mapping utility for ESPN to database team mapping
// Handles edge cases like case sensitivity, extra spaces, Unicode, etc.

interface ESPNMember {
  id: string;
  firstName: string;
  lastName: string;
}

interface ESPNTeam {
  id: number;
  name: string;
  owners: string[];
}

interface DatabaseMember {
  id: string;
  team_name: string;
  manager_name: string;
}

interface TeamMapping {
  espn_team_id: number;
  espn_team_name: string;
  espn_owner_name: string;
  db_member_id: string;
  db_team_name: string;
  db_manager_name: string;
}

export class ESPNNameMapper {
  /**
   * Normalize a name for comparison by:
   * - Converting to lowercase
   * - Trimming whitespace
   * - Collapsing multiple spaces to single space
   * - Removing common Unicode variants
   * - Handling accented characters
   */
  static normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .normalize('NFD') // Decompose Unicode characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics/accents
      .replace(/[^\w\s]/g, '') // Remove special characters except letters, numbers, spaces
  }

  /**
   * Create fuzzy matching variations of a name for additional robustness
   */
  static createNameVariations(name: string): string[] {
    const normalized = this.normalizeName(name);
    const variations = [normalized];
    
    // Add version without middle names/initials
    const nameParts = normalized.split(' ').filter(part => part.length > 1);
    if (nameParts.length > 2) {
      variations.push(`${nameParts[0]} ${nameParts[nameParts.length - 1]}`);
    }
    
    // Add version with just first and last initial
    const firstLast = normalized.split(' ');
    if (firstLast.length >= 2) {
      variations.push(`${firstLast[0]} ${firstLast[firstLast.length - 1]}`);
    }
    
    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Create mapping between ESPN teams and database members using robust name matching
   */
  static createTeamMapping(
    espnMembers: ESPNMember[],
    espnTeams: ESPNTeam[],
    dbMembers: DatabaseMember[]
  ): {
    mappings: TeamMapping[];
    unmappedEspnTeams: ESPNTeam[];
    unmappedDbMembers: DatabaseMember[];
    duplicateMatches: string[];
  } {
    const mappings: TeamMapping[] = [];
    const unmappedEspnTeams: ESPNTeam[] = [];
    const unmappedDbMembers = [...dbMembers];
    const duplicateMatches: string[] = [];

    // Create lookup maps for efficiency
    const espnMemberMap = new Map(espnMembers.map(m => [m.id, m]));
    const dbMemberByNormalizedName = new Map<string, DatabaseMember[]>();
    
    // Build database member lookup with normalized names
    dbMembers.forEach(dbMember => {
      const variations = this.createNameVariations(dbMember.manager_name);
      variations.forEach(variation => {
        if (!dbMemberByNormalizedName.has(variation)) {
          dbMemberByNormalizedName.set(variation, []);
        }
        dbMemberByNormalizedName.get(variation)!.push(dbMember);
      });
    });

    // Process each ESPN team
    for (const espnTeam of espnTeams) {
      // Track mapping status for this team
      
      // Get the primary owner (first owner in the array)
      const primaryOwnerId = espnTeam.owners[0];
      const espnMember = espnMemberMap.get(primaryOwnerId);
      
      if (!espnMember) {
        console.warn(`ESPN team ${espnTeam.id} (${espnTeam.name}) has no valid owner`);
        unmappedEspnTeams.push(espnTeam);
        continue;
      }

      // Create ESPN owner name
      const espnOwnerName = `${espnMember.firstName} ${espnMember.lastName}`;
      const espnNameVariations = this.createNameVariations(espnOwnerName);
      
      // Try to find matching database member
      let potentialMatches: DatabaseMember[] = [];
      
      for (const variation of espnNameVariations) {
        const matches = dbMemberByNormalizedName.get(variation) || [];
        potentialMatches.push(...matches);
      }
      
      // Remove duplicates
      potentialMatches = [...new Set(potentialMatches)];
      
      if (potentialMatches.length === 0) {
        console.warn(`No database match found for ESPN owner: "${espnOwnerName}"`);
        unmappedEspnTeams.push(espnTeam);
      } else if (potentialMatches.length === 1) {
        // Perfect match found
        const dbMember = potentialMatches[0];
        mappings.push({
          espn_team_id: espnTeam.id,
          espn_team_name: espnTeam.name,
          espn_owner_name: espnOwnerName,
          db_member_id: dbMember.id,
          db_team_name: dbMember.team_name,
          db_manager_name: dbMember.manager_name
        });
        
        // Remove from unmapped list
        const index = unmappedDbMembers.findIndex(m => m.id === dbMember.id);
        if (index !== -1) {
          unmappedDbMembers.splice(index, 1);
        }
        // Successfully mapped
      } else {
        // Multiple matches - this is an error condition
        const matchNames = potentialMatches.map(m => m.manager_name).join(', ');
        duplicateMatches.push(`ESPN "${espnOwnerName}" matched multiple DB members: ${matchNames}`);
        unmappedEspnTeams.push(espnTeam);
      }
    }

    return {
      mappings,
      unmappedEspnTeams,
      unmappedDbMembers,
      duplicateMatches
    };
  }

  /**
   * Validate mapping results and provide detailed feedback
   */
  static validateMapping(result: ReturnType<typeof ESPNNameMapper.createTeamMapping>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    summary: string;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for unmapped ESPN teams
    if (result.unmappedEspnTeams.length > 0) {
      errors.push(`${result.unmappedEspnTeams.length} ESPN teams could not be mapped to database members`);
      result.unmappedEspnTeams.forEach(team => {
        errors.push(`  - ESPN Team ${team.id}: "${team.name}"`);
      });
    }
    
    // Check for unmapped database members
    if (result.unmappedDbMembers.length > 0) {
      warnings.push(`${result.unmappedDbMembers.length} database members have no corresponding ESPN team`);
      result.unmappedDbMembers.forEach(member => {
        warnings.push(`  - DB Member: "${member.manager_name}" (${member.team_name})`);
      });
    }
    
    // Check for duplicate matches
    if (result.duplicateMatches.length > 0) {
      errors.push('Duplicate name matches found:');
      result.duplicateMatches.forEach(msg => errors.push(`  - ${msg}`));
    }
    
    const isValid = errors.length === 0;
    const totalMapped = result.mappings.length;
    const summary = `Successfully mapped ${totalMapped} teams. ${errors.length} errors, ${warnings.length} warnings.`;
    
    return { isValid, errors, warnings, summary };
  }

  /**
   * Get team mapping as a simple lookup map for use in import functions
   */
  static createLookupMap(mappings: TeamMapping[]): Map<number, string> {
    const lookupMap = new Map<number, string>();
    mappings.forEach(mapping => {
      lookupMap.set(mapping.espn_team_id, mapping.db_member_id);
    });
    return lookupMap;
  }
}