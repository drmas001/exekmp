import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DonorTable } from '@/components/donors/DonorTable';
import { DonorSearch } from '@/components/donors/DonorSearch';
import { DonorDeleteDialog } from '@/components/donors/DonorDeleteDialog';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { getDonors, deleteDonor } from '@/lib/api/donors';
import type { DonorApp as Donor } from '@/types/donor';
import { toast } from 'sonner';

type DonorWithStatus = Donor & { status: 'Available' | 'Utilized' };

export function DonorList() {
  const navigate = useNavigate();
  const [donors, setDonors] = useState<DonorWithStatus[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<DonorWithStatus[]>([]);
  const [selectedDonor, setSelectedDonor] = useState<DonorWithStatus | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDonors();
  }, []);

  const loadDonors = async () => {
    try {
      setIsLoading(true);
      const data = await getDonors();
      console.log('[DonorList] Data received from getDonors():', JSON.stringify(data, null, 2));
      data.forEach(d => {
        if (d.id === null || d.id === undefined || String(d.id).toLowerCase() === 'null') {
          console.warn('[DonorList] Found donor with problematic ID in getDonors() result:', d);
        }
      });
      setDonors(data as DonorWithStatus[]);
      setFilteredDonors(data as DonorWithStatus[]);
    } catch (error) {
      console.error('Error loading donors:', error);
      toast.error('Failed to load donors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (query: string, filters: { bloodType?: string; status?: string }) => {
    let filtered = [...donors];

    if (query) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(
        (donor) =>
          (donor.fullName ?? '').toLowerCase().includes(searchTerm) ||
          (donor.mrn ?? '').toLowerCase().includes(searchTerm)
      );
    }

    if (filters.bloodType) {
      filtered = filtered.filter(
        (donor) => donor.bloodType === filters.bloodType
      );
    }

    if (filters.status) {
      filtered = filtered.filter(
        (donor) => donor.status === filters.status
      );
    }

    setFilteredDonors(filtered);
  };

  const handleDelete = async (donor: DonorWithStatus) => {
    console.log('[DonorList] handleDelete called with donor:', JSON.stringify(donor, null, 2));
    if (!donor || donor.id === null || donor.id === undefined || String(donor.id).toLowerCase() === 'null') {
      console.error('[DonorList] handleDelete: Attempting to delete donor with invalid ID.', donor);
      toast.error('Cannot delete donor: Invalid ID.');
      return;
    }
    if (donor.status === 'Utilized') {
      toast.error('Cannot delete a utilized donor');
      return;
    }
    setSelectedDonor(donor);
    setShowDeleteDialog(true);
  };

  const handleEdit = (donor: DonorWithStatus) => {
    console.log('[DonorList] handleEdit called with donor:', JSON.stringify(donor, null, 2));
    if (!donor || donor.id === null || donor.id === undefined || String(donor.id).toLowerCase() === 'null') {
      console.error('[DonorList] handleEdit: Attempting to edit donor with invalid ID.', donor);
      toast.error('Cannot edit donor: Invalid ID.');
      return;
    }
    navigate(`/donors/edit/${donor.id}`);
  };

  const confirmDelete = async () => {
    console.log('[DonorList] confirmDelete called. selectedDonor:', JSON.stringify(selectedDonor, null, 2));
    if (!selectedDonor || selectedDonor.id === null || selectedDonor.id === undefined || String(selectedDonor.id).toLowerCase() === 'null') {
      console.error('[DonorList] confirmDelete: selectedDonor has invalid ID.', selectedDonor);
      toast.error('Cannot confirm delete: Invalid ID.');
      setShowDeleteDialog(false);
      setSelectedDonor(null);
      return;
    }

    try {
      await deleteDonor(selectedDonor.id);
      setDonors(prev => prev.filter(d => d.id !== selectedDonor.id));
      setFilteredDonors(prev => prev.filter(d => d.id !== selectedDonor.id));
      toast.success('Donor deleted successfully');
    } catch (error) {
      console.error('Error deleting donor:', error);
      toast.error('Failed to delete donor');
    } finally {
      setShowDeleteDialog(false);
      setSelectedDonor(null);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Donor List</h1>
        <Button onClick={() => navigate('/donors/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Add New Donor
        </Button>
      </div>

      <DonorSearch onSearch={handleSearch} />

      <DonorTable
        donors={filteredDonors}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />

      <DonorDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={confirmDelete}
        donor={selectedDonor}
      />
    </div>
  );
}