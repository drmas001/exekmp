import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MatchingResult } from '@/components/matching/MatchingResults';
import { generatePDF } from '@/lib/utils/report';
import { toast } from 'sonner';
import type { RecipientApp } from '../types/recipient';
import type { MatchResult as GlobalAppMatchResult, MatchDetailsInternal } from '../types/matching';

export default function MatchingReport() {
  const location = useLocation();
  const navigate = useNavigate();

  const { recipient, results } = (location.state as {
    recipient: RecipientApp | null;
    results: GlobalAppMatchResult[] | null;
  }) || { recipient: null, results: [] };

  const handleBack = () => {
    navigate('/matching');
  };

  const handleGenerateReport = async () => {
    if (!recipient || !results) {
      toast.error('Recipient or results data is missing.');
      return;
    }

    try {
      const reportData = {
        recipient: recipient as RecipientApp,
        results: results,
        timestamp: new Date().toISOString(),
      };
      await generatePDF(reportData);
      toast.success('PDF report generated successfully');
    } catch (error) {
      toast.error('Failed to generate PDF report');
      console.error('Error generating PDF:', error);
    }
  };

  if (!recipient || !results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground mb-4">No matching results available</p>
        <Button onClick={handleBack}>Back to Matching System</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Matching Report</h1>
        <div className="space-x-2">
          <Button variant="outline" onClick={handleBack}>
            Back to Matching
          </Button>
          <Button onClick={handleGenerateReport}>Generate PDF Report</Button>
        </div>
      </div>

      {recipient && (
        <div className="mb-6 p-4 border rounded-lg bg-card text-card-foreground">
          <h2 className="text-xl font-semibold mb-2">Recipient: {recipient.fullName || 'N/A'} (MRN: {recipient.mrn || 'N/A'})</h2>
          {/* Add more recipient details here if needed */}
        </div>
      )}

      <div className="space-y-4">
        {results.map((res, index) => {
          return (
            <MatchingResult
              key={index}
              recipient={recipient as RecipientApp}
              donor={res.donor} 
              isMatch={res.isCompatible}
              exclusionReason={res.exclusionReason === null ? undefined : res.exclusionReason} 
              hlaMatches={res.matchDetails?.hlaMatches}
            />
          );
        })}
      </div>
    </div>
  );
}