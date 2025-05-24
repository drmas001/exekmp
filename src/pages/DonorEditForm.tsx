import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DonorPersonalInfo } from '@/components/donors/DonorPersonalInfo';
import { DonorHLATyping } from '@/components/donors/DonorHLATyping';
import { DonorMedicalInfo } from '@/components/donors/DonorMedicalInfo';
import { DonorAdditionalInfo } from '@/components/donors/DonorAdditionalInfo';
import { Button } from '@/components/ui/button';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { donorSchema } from '@/lib/validations/donor';
import { getDonor, updateDonor } from '@/lib/api/donors';
import type { DonorFormData } from '@/types/donor';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function DonorEditForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(false);
  
  const methods = useForm<DonorFormData>({
    resolver: zodResolver(donorSchema),
  });

  useEffect(() => {
    if (!id) {
      console.error('[DonorEditForm] ID from useParams is undefined or null.');
      toast.error('Donor ID is missing. Cannot load form.');
      navigate('/donors');
      return;
    }
    console.log(`[DonorEditForm] useEffect triggered with ID from useParams: "${id}" (type: ${typeof id})`);
    
    const loadDonor = async () => {
      try {
        setIsLoading(true);
        console.log(`[DonorEditForm] Calling getDonor with ID: "${id}"`); // Log before the call
        const donor = await getDonor(id);
        
        if (!donor) {
          toast.error('Donor not found.');
          console.warn(`[DonorEditForm] getDonor("${id}") returned null or undefined.`);
          navigate('/donors');
          return;
        }
        
        // Transform the data to match form fields
        let formDonorAntibodiesString = '';
        if (donor.donorAntibodies) {
          if (typeof donor.donorAntibodies === 'string') {
            formDonorAntibodiesString = donor.donorAntibodies;
          } else {
            // If it's an object/array (parsed JSON), stringify it for the form input
            try {
              formDonorAntibodiesString = JSON.stringify(donor.donorAntibodies);
            } catch (e) {
              console.error('Error stringifying donor.donorAntibodies for form:', e);
              // Attempt to use raw value if parsing failed and it was wrapped in an error object by transformDonorData
              if (donor.donorAntibodies && typeof (donor.donorAntibodies as any).raw === 'string') {
                formDonorAntibodiesString = (donor.donorAntibodies as any).raw;
              } else {
                formDonorAntibodiesString = ''; // Default fallback
              }
            }
          }
        }

        const formData = {
          mrn: donor.mrn || '',
          nationalId: donor.nationalId || '',
          fullName: donor.fullName || '',
          age: donor.age || 0,
          bloodType: donor.bloodType || '',
          mobileNumber: donor.mobileNumber || '',
          hlaA: donor.hlaTyping?.hlaA || '',
          hlaB: donor.hlaTyping?.hlaB || '',
          hlaC: donor.hlaTyping?.hlaC || '',
          hlaDR: donor.hlaTyping?.hlaDR || '',
          hlaDQ: donor.hlaTyping?.hlaDQ || '',
          hlaDP: donor.hlaTyping?.hlaDP || '',
          crossmatchResult: donor.crossmatchResult || '',
          donorAntibodies: formDonorAntibodiesString, // Use the processed string
          serumCreatinine: donor.serumCreatinine || 0,
          egfr: donor.egfr || 0,
          bloodPressure: donor.bloodPressure || '',
          viralScreening: donor.viralScreening || '',
          cmvStatus: donor.cmvStatus || '',
          medicalConditions: donor.medicalConditions || '',
          notes: donor.notes || '',
          highResTyping: donor.highResTyping || '',
          antigenMismatch: donor.antigenMismatch || 0,
          status: donor.status || 'Available', // Ensure status is part of Donor type and handled
        };
        
        methods.reset(formData as DonorFormData); // Cast if necessary, ensure DonorFormData matches this structure
      } catch (error) {
        console.error('Error loading donor:', error);
        toast.error('Failed to load donor information');
        navigate('/donors');
      } finally {
        setIsLoading(false);
      }
    };

    loadDonor();
  }, [id, methods, navigate]);

  const onSubmit = async (data: DonorFormData) => {
    if (!id) return;

    try {
      // Validate required fields
      if (!data.bloodType) {
        toast.error('Please select a blood type');
        return;
      }
      if (!data.crossmatchResult) {
        toast.error('Please select a crossmatch result');
        return;
      }
      if (!data.cmvStatus) {
        toast.error('Please select a CMV status');
        return;
      }

      // Show loading state
      const loadingToast = toast.loading('Updating donor information...');
      setIsLoading(true);

      // Update donor
      await updateDonor(id, data);
      
      // Clear loading state and show success
      toast.dismiss(loadingToast);
      toast.success('Donor information updated successfully');
      
      // Navigate back to list
      navigate('/donors');
    } catch (error) {
      console.error('Error updating donor:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to update donor information');
      }
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
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-8">
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-2xl font-semibold mb-6">Edit Donor Information</h1>
          <div className="space-y-8">
            <DonorPersonalInfo />
            <DonorHLATyping />
            <DonorMedicalInfo />
            <DonorAdditionalInfo />
            <div className="flex justify-end gap-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate('/donors')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || methods.formState.isSubmitting}
                className="gap-2"
              >
                {(isLoading || methods.formState.isSubmitting) && (
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