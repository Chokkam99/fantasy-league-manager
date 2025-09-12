// Offline validation script for historical season import data
// Validates the Gridiron Gurus 2024 data before database import

const gridironGurus2024 = {
  league: "Gridiron Gurus",
  season: "2024",
  entryFee: 20.00,
  totalPot: 200.00, // 10 teams × $20
  prizes: {
    first: 100.00,
    second: 60.00, 
    third: 40.00
  },
  teams: [
    {"manager_name": "Mihir Sriram Aranala", "team_name": "Aranala Boyz", "scores": [116.34, 141.84, 147.02, 126.8, 168.62, 122.96, 135.24, 145.84, 160.78, 152.08, 162.52, 168.56, 146.58, 168.02, 201.7, 190.46, 193.9]},
    {"manager_name": "Sai Kaliappan Namasivayam", "team_name": "Chennaiyin FC", "scores": [132.72, 151.08, 108.42, 141.28, 108.2, 152.84, 183.12, 174.66, 146.3, 90.44, 184.82, 154.82, 153.36, 149.68, 140.36, 243.56, 185.24]},
    {"manager_name": "Rithvik Chokkam", "team_name": "Take Mahomes Country Road", "scores": [125.46, 157.8, 187.3, 154.48, 148.84, 151.12, 134.82, 139.0, 114.56, 146.24, 176.38, 106.48, 141.18, 184.24, 140.36, 182.14, 168.42]},
    {"manager_name": "Vivek D C", "team_name": "Blue Devils", "scores": [128.06, 98.42, 156.16, 160.84, 145.96, 115.94, 122.5, 156.44, 143.84, 123.24, 105.12, 127.74, 127.02, 144.96, 140.36, 144.18, 133.62]},
    {"manager_name": "Rene M", "team_name": "Tuafinity and Beyond", "scores": [168.16, 143.5, 110.88, 153.74, 155.02, 152.66, 107.7, 167.22, 184.86, 111.34, 115.48, 172.58, 142.38, 119.62, 142.32, 140.08, 160.6]},
    {"manager_name": "Deebthik Ravi", "team_name": "Team Deebs", "scores": [129.94, 143.94, 103.36, 134.52, 155.02, 147.68, 93.96, 125.32, 166.1, 122.06, 148.78, 115.88, 102.06, 143.92, 93.36, 130.86, 80.76]},
    {"manager_name": "Anand James", "team_name": "CarryRunSometimesKickBall", "scores": [129.46, 105.8, 87.8, 114.72, 165.26, 103.42, 107.7, 153.38, 160.78, 135.52, 141.72, 127.74, 167.76, 126.8, 115.28, 123.82, 128.86]},
    {"manager_name": "Adam Levin", "team_name": "Levin's Warriors", "scores": [130.48, 151.56, 121.7, 120.48, 136.54, 151.12, 97.24, 121.24, 106.32, 121.28, 141.72, 133.08, 138.22, 115.16, 155.84, 162.72, 120.68]},
    {"manager_name": "Gopik Anand", "team_name": "Not Real ⚽ FC", "scores": [146.0, 139.26, 94.72, 118.76, 137.16, 149.96, 119.1, 167.22, 138.5, 172.06, 136.92, 89.2, 153.36, 172.6, 134.98, 108.52, 160.38]},
    {"manager_name": "Raahul vignesh Manikandan", "team_name": "Arvus Radiance", "scores": [93.92, 105.32, 114.9, 135.56, 122.64, 168.58, 116.36, 153.38, 157.22, 106.98, 115.48, 112.78, 139.98, 144.16, 143.76, 69.52, 95.72]}
  ],
  championship: {
    week: 17,
    team1: "Mihir Sriram Aranala",
    team1Score: 193.9,
    team2: "Sai Kaliappan Namasivayam", 
    team2Score: 185.24,
    winner: "Mihir Sriram Aranala"
  },
  thirdPlace: {
    week: 17,
    team1: "Rithvik Chokkam",
    team1Score: 168.42,
    team2: "Vivek D C",
    team2Score: 133.62,
    winner: "Rithvik Chokkam"
  }
};

function validateData() {
  console.log('=== GRIDIRON GURUS 2024 DATA VALIDATION ===\n');
  
  // Basic counts
  console.log(`League: ${gridironGurus2024.league}`);
  console.log(`Season: ${gridironGurus2024.season}`);
  console.log(`Entry Fee: $${gridironGurus2024.entryFee}`);
  console.log(`Teams: ${gridironGurus2024.teams.length}`);
  
  // Prize validation
  const prizeTotal = Object.values(gridironGurus2024.prizes).reduce((sum, prize) => sum + prize, 0);
  console.log(`Prize Total: $${prizeTotal} (out of $${gridironGurus2024.totalPot} pot)`);
  
  console.log('\n=== TEAM DATA VALIDATION ===');
  
  let allScoresValid = true;
  let totalScores = 0;
  
  gridironGurus2024.teams.forEach((team, index) => {
    const scoreCount = team.scores.length;
    const totalPoints = team.scores.reduce((sum, score) => sum + score, 0);
    const avgPoints = totalPoints / scoreCount;
    const minScore = Math.min(...team.scores);
    const maxScore = Math.max(...team.scores);
    
    console.log(`${index + 1}. ${team.manager_name} (${team.team_name})`);
    console.log(`   Scores: ${scoreCount}/17 | Avg: ${avgPoints.toFixed(1)} | Range: ${minScore}-${maxScore}`);
    
    if (scoreCount !== 17) {
      console.log(`   ⚠️  ERROR: Expected 17 scores, got ${scoreCount}`);
      allScoresValid = false;
    }
    
    // Check for unrealistic scores
    const outliers = team.scores.filter(score => score < 50 || score > 250);
    if (outliers.length > 0) {
      console.log(`   ⚠️  OUTLIERS: ${outliers.join(', ')}`);
    }
    
    totalScores += scoreCount;
  });
  
  console.log(`\nTotal scores collected: ${totalScores} (expected: 170)`);
  console.log(`All teams have 17 scores: ${allScoresValid ? '✅' : '❌'}`);
  
  console.log('\n=== CHAMPIONSHIP VALIDATION ===');
  
  // Find championship teams in final standings
  const champTeam = gridironGurus2024.teams.find(t => t.manager_name === gridironGurus2024.championship.team1);
  const runnerUpTeam = gridironGurus2024.teams.find(t => t.manager_name === gridironGurus2024.championship.team2);
  
  if (champTeam && runnerUpTeam) {
    const champWeek17 = champTeam.scores[16]; // Week 17 (index 16)
    const runnerUpWeek17 = runnerUpTeam.scores[16];
    
    console.log(`Championship Game (Week 17):`);
    console.log(`${gridironGurus2024.championship.team1}: ${champWeek17} vs ${gridironGurus2024.championship.team2}: ${runnerUpWeek17}`);
    console.log(`Winner: ${gridironGurus2024.championship.winner} (${champWeek17 > runnerUpWeek17 ? '✅' : '❌'})`);
  }
  
  // Validate 3rd place game
  const thirdPlaceTeam1 = gridironGurus2024.teams.find(t => t.manager_name === gridironGurus2024.thirdPlace.team1);
  const thirdPlaceTeam2 = gridironGurus2024.teams.find(t => t.manager_name === gridironGurus2024.thirdPlace.team2);
  
  if (thirdPlaceTeam1 && thirdPlaceTeam2) {
    const team1Week17 = thirdPlaceTeam1.scores[16];
    const team2Week17 = thirdPlaceTeam2.scores[16];
    
    console.log(`3rd Place Game (Week 17):`);
    console.log(`${gridironGurus2024.thirdPlace.team1}: ${team1Week17} vs ${gridironGurus2024.thirdPlace.team2}: ${team2Week17}`);
    console.log(`Winner: ${gridironGurus2024.thirdPlace.winner} (${team1Week17 > team2Week17 ? '✅' : '❌'})`);
  }
  
  console.log('\n=== IMPORT READINESS ===');
  
  const readyForImport = allScoresValid && totalScores === 170 && prizeTotal <= gridironGurus2024.totalPot;
  console.log(`Ready for database import: ${readyForImport ? '✅' : '❌'}`);
  
  if (readyForImport) {
    console.log('\n✅ Data validation passed! The import script should work correctly.');
    console.log('Expected results after import:');
    console.log('- 1st Place: Mihir Sriram Aranala (Aranala Boyz)');
    console.log('- 2nd Place: Sai Kaliappan Namasivayam (Chennaiyin FC)'); 
    console.log('- 3rd Place: Rithvik Chokkam (Take Mahomes Country Road)');
  }
  
  return readyForImport;
}

// Calculate expected standings to verify import logic
function calculateExpectedStandings() {
  console.log('\n=== EXPECTED FINAL STANDINGS ===');
  
  const standings = gridironGurus2024.teams.map(team => {
    const totalPoints = team.scores.reduce((sum, score) => sum + score, 0);
    const avgPoints = totalPoints / 17;
    
    return {
      manager: team.manager_name,
      team: team.team_name,
      totalPoints: totalPoints,
      avgPoints: avgPoints.toFixed(2)
    };
  });
  
  // Sort by total points (proxy for wins in most leagues)
  standings.sort((a, b) => b.totalPoints - a.totalPoints);
  
  standings.forEach((team, index) => {
    console.log(`${index + 1}. ${team.manager} - ${team.totalPoints} pts (${team.avgPoints} avg)`);
  });
  
  return standings;
}

// Run validation
if (require.main === module) {
  const isValid = validateData();
  const expectedStandings = calculateExpectedStandings();
  
  if (isValid) {
    console.log('\n🎉 Validation complete! Data is ready for import.');
  } else {
    console.log('\n❌ Validation failed. Please review data before importing.');
  }
}

module.exports = { gridironGurus2024, validateData, calculateExpectedStandings };