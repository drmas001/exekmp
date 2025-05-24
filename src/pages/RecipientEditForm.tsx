import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RecipientPersonalInfo } from '@/components/recipients/RecipientPersonalInfo';
import { RecipientHLATyping } from '@/components/recipients/RecipientHLATyping';
import { RecipientMedicalInfo } from '@/components/recipients/RecipientMedicalInfo';
import { RecipientAdditionalInfo } from '@/components/recipients/RecipientAdditionalInfo';
import { Button } from '@/components/ui/button';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { recipientSchema } from '@/lib/validations/recipient';
import { getRecipientById, updateRecipient } from '@/lib/api/recipients';
import type { RecipientFormData } from '@/types/recipient';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function RecipientEditForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const methods = useForm<RecipientFormData>({
    resolver: zodResolver(recipientSchema),
  });

  useEffect(() => {
    if (id) {
      const fetchRecipient = async () => {
        try {
          const recipient = await getRecipientById(id);
          if (recipient) {
            // Transform RecipientApp to RecipientFormData for the form
            methods.reset({
              mrn: recipient.mrn || '',
              nationalId: recipient.nationalId || '',
              fullName: recipient.fullName || '',
              age: recipient.age ?? 0, // age is number? | null in RecipientApp
              bloodType: recipient.bloodType || '',
              mobileNumber: recipient.mobileNumber || '',
              hlaA: recipient.hlaTyping?.hlaA || '',
              hlaB: recipient.hlaTyping?.hlaB || '',
              hlaC: recipient.hlaTyping?.hlaC || '',
              hlaDR: recipient.hlaTyping?.hlaDR || '',
              hlaDQ: recipient.hlaTyping?.hlaDQ || '',
              hlaDP: recipient.hlaTyping?.hlaDP || '',
              // RecipientApp stores these as string[], RecipientFormData expects string (JSON stringified)
              unacceptableAntigens: JSON.stringify(recipient.unacceptableAntigens || []),
              pra: recipient.pra, // pra is number in RecipientApp
              crossmatchRequirement: recipient.crossmatchRequirement || '',
              donorAntibodies: JSON.stringify(recipient.donorAntibodies || []),
              serumCreatinine: recipient.serumCreatinine, // serumCreatinine is number in RecipientApp
              egfr: recipient.egfr, // egfr is number in RecipientApp
              bloodPressure: recipient.bloodPressure || '',
              viralScreening: recipient.viralScreening || '',
              cmvStatus: recipient.cmvStatus || '',
              medicalHistory: recipient.medicalHistory || '',
              notes: recipient.notes || '',
            });
          } else {
            toast.error('Recipient not found.');
            navigate('/recipients');
          }
        } catch (error) {
          console.error('Failed to fetch recipient:', error);
          toast.error('Failed to load recipient data.');
        }
      };
      fetchRecipient();
    }
  }, [id, methods.reset, navigate]);

  const onSubmit = async (data: RecipientFormData) => {
    console.log('[RecipientEditForm] onSubmit - ID from useParams at start:', id);
    console.log('[RecipientEditForm] onSubmit - Raw data from react-hook-form:', JSON.stringify(data, null, 2));

    if (!id) {
      console.error('[RecipientEditForm] onSubmit - No ID found, cannot update.');
      toast.error('Recipient ID is missing, cannot update.');
      return;
    }

    const dataToSend = data;

    console.log('[RecipientEditForm] onSubmit - Attempting to update recipient. Current ID for update:', id);
    console.log('[RecipientEditForm] onSubmit - Data being sent to updateRecipient:', JSON.stringify(dataToSend, null, 2));

    let loadingToastId: string | number | undefined;

    try {
      if (!dataToSend.bloodType) {
        toast.error('Please select a blood type');
        return;
      }
      if (!dataToSend.crossmatchRequirement) {
        toast.error('Please select a crossmatch requirement');
        return;
      }
      if (!dataToSend.cmvStatus) {
        toast.error('Please select a CMV status');
        return;
      }

      loadingToastId = toast.loading('Updating recipient information...');

      await updateRecipient(id, dataToSend);
      
      if (loadingToastId) toast.dismiss(loadingToastId);
      toast.success('Recipient information updated successfully');
      
      navigate('/recipients');
    } catch (error) {
      console.error('Error updating recipient:', error);
      if (loadingToastId) toast.dismiss(loadingToastId); 
      toast.error('Failed to update recipient information');
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8">
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-2xl font-semibold mb-6">Edit Recipient Information</h1>
          <div className="space-y-8">
            <RecipientPersonalInfo />
            <RecipientHLATyping />
            <RecipientMedicalInfo />
            <RecipientAdditionalInfo />
            <div className="flex justify-end gap-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate('/recipients')}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={methods.formState.isSubmitting}
                className="gap-2"
              >
                {methods.formState.isSubmitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
} 