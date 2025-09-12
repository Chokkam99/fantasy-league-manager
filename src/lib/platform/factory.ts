// Platform factory - automatically creates the correct client/service based on platform type
import { PlatformType, PlatformConfig, PlatformImportService } from './types'
import { ESPNImportService } from '../espn/import'

export class PlatformFactory {
  /**
   * Create platform import service based on platform type
   */
  static createImportService(
    leagueId: string, 
    season: string, 
    config: PlatformConfig
  ): PlatformImportService {
    switch (config.platform_type) {
      case 'espn':
        return new ESPNImportService(leagueId, season, {
          league_id: config.league_id,
          year: config.year,
          private_league: config.private_league,
          espn_s2: config.credentials?.espn_s2,
          swid: config.credentials?.swid
        })
      
      case 'yahoo':
        // TODO: Implement Yahoo import service
        throw new Error('Yahoo integration not yet implemented')
      
      case 'sleeper':
        // TODO: Implement Sleeper import service  
        throw new Error('Sleeper integration not yet implemented')
      
      case 'manual':
        throw new Error('Manual leagues do not support automatic import')
      
      default:
        throw new Error(`Unsupported platform type: ${config.platform_type}`)
    }
  }

  /**
   * Get platform display name
   */
  static getPlatformName(platformType: PlatformType): string {
    switch (platformType) {
      case 'espn': return 'ESPN Fantasy'
      case 'yahoo': return 'Yahoo Fantasy'
      case 'sleeper': return 'Sleeper'
      case 'manual': return 'Manual Entry'
      default: return 'Unknown Platform'
    }
  }

  /**
   * Get configuration fields required for each platform
   */
  static getRequiredFields(platformType: PlatformType): Array<{
    key: string
    label: string
    type: 'text' | 'password' | 'checkbox'
    required: boolean
    help?: string
  }> {
    switch (platformType) {
      case 'espn':
        return [
          {
            key: 'league_id',
            label: 'ESPN League ID',
            type: 'text',
            required: true,
            help: 'Find this in your ESPN league URL (e.g., 1552816)'
          },
          {
            key: 'private_league',
            label: 'Private League',
            type: 'checkbox',
            required: false,
            help: 'Check if your league requires login to view'
          },
          {
            key: 'espn_s2',
            label: 'ESPN_S2 Cookie',
            type: 'password',
            required: false,
            help: 'Required for private leagues only'
          },
          {
            key: 'swid',
            label: 'SWID Cookie',
            type: 'password',
            required: false,
            help: 'Required for private leagues only'
          }
        ]
      
      case 'yahoo':
        return [
          {
            key: 'league_id',
            label: 'Yahoo League ID',
            type: 'text',
            required: true,
            help: 'Find this in your Yahoo league URL'
          },
          {
            key: 'consumer_key',
            label: 'Yahoo Consumer Key',
            type: 'password',
            required: true,
            help: 'OAuth consumer key from Yahoo Developer'
          },
          {
            key: 'consumer_secret',
            label: 'Yahoo Consumer Secret',
            type: 'password',
            required: true,
            help: 'OAuth consumer secret from Yahoo Developer'
          }
        ]
      
      case 'sleeper':
        return [
          {
            key: 'league_id',
            label: 'Sleeper League ID',
            type: 'text',
            required: true,
            help: 'Find this in your Sleeper league URL'
          }
        ]
      
      case 'manual':
        return []
      
      default:
        return []
    }
  }

  /**
   * Get supported platforms
   */
  static getSupportedPlatforms(): Array<{
    type: PlatformType
    name: string
    available: boolean
  }> {
    return [
      { type: 'manual', name: 'Manual Entry', available: true },
      { type: 'espn', name: 'ESPN Fantasy', available: true },
      { type: 'yahoo', name: 'Yahoo Fantasy', available: false }, // TODO
      { type: 'sleeper', name: 'Sleeper', available: false } // TODO
    ]
  }
}