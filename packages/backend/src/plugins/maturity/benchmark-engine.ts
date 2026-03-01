/**
 * Team Maturity Benchmarking Engine
 * Implements cross-team maturity comparison and ranking
 */

import {
  TeamBenchmark,
  ServiceScorecard,
} from './types';

export interface ServiceScore {
  serviceId: string;
  serviceName: string;
  score: number;
  team: string;
}

export interface TeamRanking {
  rank: number;
  teamId: string;
  averageScore: number;
  serviceCount: number;
  change?: number; // Change in rank from previous period
}

export interface BenchmarkComparison {
  teamId: string;
  averageScore: number;
  percentile: number; // 0-100, where team ranks among all teams
  aboveAverage: boolean;
  gap: number; // Difference from organization average
  organizationAverage: number;
}

export class BenchmarkEngine {
  /**
   * Calculate team benchmark from service scorecards
   */
  calculateTeamBenchmark(
    teamId: string,
    scorecards: ServiceScorecard[],
  ): TeamBenchmark {
    if (scorecards.length === 0) {
      return {
        teamId,
        averageScore: 0,
        serviceCount: 0,
        distribution: {},
        topServices: [],
        bottomServices: [],
      };
    }

    // Calculate average score
    const totalScore = scorecards.reduce((sum, sc) => sum + sc.overallScore, 0);
    const averageScore = totalScore / scorecards.length;

    // Calculate score distribution (buckets: 0-20, 20-40, 40-60, 60-80, 80-100)
    const distribution: Record<string, number> = {
      '0-20': 0,
      '20-40': 0,
      '40-60': 0,
      '60-80': 0,
      '80-100': 0,
    };

    for (const scorecard of scorecards) {
      const score = scorecard.overallScore;
      if (score < 20) distribution['0-20']++;
      else if (score < 40) distribution['20-40']++;
      else if (score < 60) distribution['40-60']++;
      else if (score < 80) distribution['60-80']++;
      else distribution['80-100']++;
    }

    // Sort services by score
    const sortedServices = [...scorecards].sort(
      (a, b) => b.overallScore - a.overallScore,
    );

    // Get top 5 and bottom 5 services
    const topServices = sortedServices
      .slice(0, Math.min(5, sortedServices.length))
      .map(sc => ({
        serviceId: sc.serviceId,
        score: sc.overallScore,
      }));

    const bottomServices = sortedServices
      .slice(Math.max(0, sortedServices.length - 5))
      .reverse()
      .map(sc => ({
        serviceId: sc.serviceId,
        score: sc.overallScore,
      }));

    return {
      teamId,
      averageScore: Math.round(averageScore * 100) / 100,
      serviceCount: scorecards.length,
      distribution,
      topServices,
      bottomServices,
    };
  }

  /**
   * Calculate benchmarks for all teams
   */
  calculateAllTeamBenchmarks(
    serviceScores: ServiceScore[],
  ): Map<string, TeamBenchmark> {
    // Group services by team
    const teamServices = new Map<string, ServiceScore[]>();
    
    for (const service of serviceScores) {
      if (!teamServices.has(service.team)) {
        teamServices.set(service.team, []);
      }
      teamServices.get(service.team)!.push(service);
    }

    // Calculate benchmark for each team
    const benchmarks = new Map<string, TeamBenchmark>();
    
    for (const [teamId, services] of teamServices.entries()) {
      // Convert ServiceScore to ServiceScorecard format
      const scorecards: ServiceScorecard[] = services.map(s => ({
        serviceId: s.serviceId,
        overallScore: s.score,
        categories: {} as any, // Not needed for benchmark calculation
        lastUpdated: new Date(),
        expiresAt: new Date(),
        version: 1,
      }));
      
      const benchmark = this.calculateTeamBenchmark(teamId, scorecards);
      benchmarks.set(teamId, benchmark);
    }

    return benchmarks;
  }

  /**
   * Generate team rankings
   */
  generateTeamRankings(
    benchmarks: Map<string, TeamBenchmark>,
    previousRankings?: Map<string, number>,
  ): TeamRanking[] {
    // Convert to array and sort by average score (descending)
    const rankings: TeamRanking[] = Array.from(benchmarks.entries())
      .sort((a, b) => b[1].averageScore - a[1].averageScore)
      .map(([teamId, benchmark], index) => {
        const rank = index + 1;
        const previousRank = previousRankings?.get(teamId);
        
        return {
          rank,
          teamId,
          averageScore: benchmark.averageScore,
          serviceCount: benchmark.serviceCount,
          change: previousRank !== undefined ? previousRank - rank : undefined,
        };
      });

    return rankings;
  }

  /**
   * Generate service rankings across all teams
   */
  generateServiceRankings(
    serviceScores: ServiceScore[],
  ): Array<ServiceScore & { rank: number }> {
    return serviceScores
      .sort((a, b) => b.score - a.score)
      .map((service, index) => ({
        ...service,
        rank: index + 1,
      }));
  }

  /**
   * Compare team against organization
   */
  compareTeamToOrganization(
    teamId: string,
    benchmarks: Map<string, TeamBenchmark>,
  ): BenchmarkComparison {
    const teamBenchmark = benchmarks.get(teamId);
    
    if (!teamBenchmark) {
      throw new Error(`Team ${teamId} not found in benchmarks`);
    }

    // Calculate organization average
    const allScores = Array.from(benchmarks.values()).map(b => b.averageScore);
    const orgAverage = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

    // Calculate percentile
    const teamsBelow = allScores.filter(score => score < teamBenchmark.averageScore).length;
    const percentile = (teamsBelow / allScores.length) * 100;

    // Calculate gap
    const gap = teamBenchmark.averageScore - orgAverage;

    return {
      teamId,
      averageScore: teamBenchmark.averageScore,
      percentile: Math.round(percentile * 100) / 100,
      aboveAverage: gap > 0,
      gap: Math.round(gap * 100) / 100,
      organizationAverage: Math.round(orgAverage * 100) / 100,
    };
  }

  /**
   * Get top performing teams
   */
  getTopTeams(
    benchmarks: Map<string, TeamBenchmark>,
    limit: number = 5,
  ): TeamBenchmark[] {
    return Array.from(benchmarks.values())
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, limit);
  }

  /**
   * Get teams needing improvement
   */
  getTeamsNeedingImprovement(
    benchmarks: Map<string, TeamBenchmark>,
    threshold: number = 60,
    limit: number = 5,
  ): TeamBenchmark[] {
    return Array.from(benchmarks.values())
      .filter(b => b.averageScore < threshold)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, limit);
  }

  /**
   * Calculate organization-wide statistics
   */
  calculateOrganizationStats(
    benchmarks: Map<string, TeamBenchmark>,
  ): {
    totalTeams: number;
    totalServices: number;
    averageScore: number;
    medianScore: number;
    highestScore: number;
    lowestScore: number;
    standardDeviation: number;
  } {
    const scores = Array.from(benchmarks.values()).map(b => b.averageScore);
    const totalServices = Array.from(benchmarks.values()).reduce(
      (sum, b) => sum + b.serviceCount,
      0,
    );

    if (scores.length === 0) {
      return {
        totalTeams: 0,
        totalServices: 0,
        averageScore: 0,
        medianScore: 0,
        highestScore: 0,
        lowestScore: 0,
        standardDeviation: 0,
      };
    }

    // Calculate average
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Calculate median
    const sortedScores = [...scores].sort((a, b) => a - b);
    const median =
      sortedScores.length % 2 === 0
        ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
        : sortedScores[Math.floor(sortedScores.length / 2)];

    // Calculate standard deviation
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    return {
      totalTeams: benchmarks.size,
      totalServices,
      averageScore: Math.round(average * 100) / 100,
      medianScore: Math.round(median * 100) / 100,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      standardDeviation: Math.round(stdDev * 100) / 100,
    };
  }
}
