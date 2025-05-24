import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Heart, Users, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DashboardStats {
  totalDonors: number;
  totalRecipients: number;
  successfulMatches: number;
  pendingMatches: number;
}

interface Activity {
  id: string;
  type: 'donor_added' | 'match_found' | 'urgent_review';
  content: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info';
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDonors: 0,
    totalRecipients: 0,
    successfulMatches: 0,
    pendingMatches: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch total donors
      const allDonors = await window.electronAPI.getDonors();
      const donorCount = allDonors?.length || 0;

      // Fetch total recipients
      const recipientCount = await window.electronAPI.getRecipientCount();

      // Fetch matching results statuses
      const matchingResultsStatuses = await window.electronAPI.getAllMatchingResultsStatus();

      const successfulMatches = matchingResultsStatuses?.filter(
        (match) => match.status === 'Approved'
      ).length || 0;

      const pendingMatches = matchingResultsStatuses?.filter(
        (match) => match.status === 'Pending'
      ).length || 0;

      setStats({
        totalDonors: donorCount,
        totalRecipients: recipientCount || 0,
        successfulMatches,
        pendingMatches,
      });

      // Fetch recent donors
      const recentDonorsData = await window.electronAPI.getRecentDonors();

      // Fetch recent matches
      const recentMatchesData = await window.electronAPI.getRecentMatches();

      // Transform into activities
      const activitiesData: Activity[] = [
        ...(recentDonorsData?.map((donor) => ({
          id: donor.id,
          type: 'donor_added' as const,
          content: `New donor ${donor.full_name} added to the system`,
          timestamp: donor.created_at || new Date().toISOString(),
          status: 'success' as const,
        })) || []),
        ...(recentMatchesData?.map((match) => ({
          id: match.id,
          type: 'match_found' as const,
          content: `Potential match found for recipient ${match.recipient_full_name}`,
          timestamp: match.created_at || new Date().toISOString(),
          status: match.status === 'Pending' ? ('warning' as const) : ('info' as const),
        })) || []),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(activitiesData.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 bg-background/95 backdrop-blur-sm rounded-lg p-8 border shadow-sm">
        <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
          Welcome to Kidney Match Pro
        </h1>
        <p className="text-lg text-muted-foreground">
          Streamlining kidney donor and recipient management with precision and
          care.
        </p>
      </div>

      <div className="mb-8">
        <QuickActions />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatsCard
          title="Total Donors"
          value={stats.totalDonors}
          icon={Heart}
        />
        <StatsCard
          title="Total Recipients"
          value={stats.totalRecipients}
          icon={Users}
        />
        <StatsCard
          title="Successful Matches"
          value={stats.successfulMatches}
          icon={CheckCircle}
        />
        <StatsCard
          title="Pending Matches"
          value={stats.pendingMatches}
          icon={Clock}
        />
      </div>

      <div className="grid gap-6">
        <ActivityFeed activities={activities} />
      </div>
    </>
  );
}