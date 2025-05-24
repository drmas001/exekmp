import { useNavigate } from 'react-router-dom';
import { RecipientPersonalInfo } from '@/components/recipients/RecipientPersonalInfo';
import { RecipientHLATyping } from '@/components/recipients/RecipientHLATyping';
import { RecipientMedicalInfo } from '@/components/recipients/RecipientMedicalInfo';
import { RecipientAdditionalInfo } from '@/components/recipients/RecipientAdditionalInfo';
import { Button } from '@/components/ui/button';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { recipientSchema } from '@/lib/validations/recipient';
import { addRecipient } from '@/lib/api/recipients';
import type { RecipientFormData } from '@/types/recipient';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function RecipientForm() {
  const navigate = useNavigate();
  const methods = useForm<RecipientFormData>({
    resolver: zodResolver(recipientSchema),
    defaultValues: {
      mrn: '',
      nationalId: '',
      fullName: '',
      age: 0,
      bloodType: '',
      mobileNumber: '',
      hlaA: '',
      hlaB: '',
      hlaC: '',
      hlaDR: '',
      hlaDQ: '',
      hlaDP: '',
      unacceptableAntigens: '',
      pra: 0,
      crossmatchRequirement: '',
      donorAntibodies: '',
      serumCreatinine: 0,
      egfr: 0,
      bloodPressure: '',
      viralScreening: '',
      cmvStatus: '',
      medicalHistory: '',
      notes: '',
    },
  });

  const onSubmit = async (data: RecipientFormData) => {
    // Detailed HLA logging for debugging
    console.log('[onSubmit] Raw data object:', data);
    console.log('[onSubmit] data.hlaA:', data.hlaA);
    console.log('[onSubmit] data.hlaB:', data.hlaB);
    console.log('[onSubmit] data.hlaC:', data.hlaC);
    console.log('[onSubmit] data.hlaDR:', data.hlaDR);
    console.log('[onSubmit] data.hlaDQ:', data.hlaDQ);
    console.log('[onSubmit] data.hlaDP:', data.hlaDP);

    try {
      // Validate required fields
      if (!data.bloodType) {
        toast.error('Please select a blood type');
        return;
      }
      if (!data.hlaA || !data.hlaB || !data.hlaC || !data.hlaDR || !data.hlaDQ || !data.hlaDP) {
        toast.error('Please fill in all HLA typing fields');
        return;
      }

      // Log the data being sent
      console.log('Submitting recipient data:', data);

      const newRecipient = await addRecipient(data);

      if (newRecipient) {
        console.log('Recipient added successfully:', newRecipient);
        toast.success('Recipient added successfully!');
        methods.reset(); // Reset form after successful submission
        navigate('/recipients'); // Redirect to recipient list
      } else {
        console.error('Failed to add recipient, addRecipient returned null or undefined.');
        toast.error('Failed to add recipient. Please try again.');
      }
    } catch (error) {
      console.error('Failed to add recipient:', error);
      toast.error(`Failed to add recipient: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8">
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-2xl font-semibold mb-6">New Recipient Registration</h1>
          <div className="space-y-8">
            <RecipientPersonalInfo />
            <RecipientHLATyping />
            <RecipientMedicalInfo />
            <RecipientAdditionalInfo />
            <div className="flex justify-end gap-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate('/matching')}
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
                Save Recipient Information
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}