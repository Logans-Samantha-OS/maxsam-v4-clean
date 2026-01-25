const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tidcqvhxdsbnfykbvygs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZGNxdmh4ZHNibmZ5a2J2eWdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk3NzEzOSwiZXhwIjoyMDc4NTUzMTM5fQ.gZs_O-mQX_c3E_0kKXToUWuQX9OCxNGzz_-XrhW6LVw'
);

async function fixDuplicate() {
  // Update Sharon's lead with merged data
  const { data, error } = await supabase
    .from('maxsam_leads')
    .update({
      eleanor_score: 80,
      eleanor_grade: 'A',
      excess_funds_amount: 105629.61,
      property_address: '2932 Percheron Dr, Mesquite, TX 75150',
      property_city: 'Mesquite',
      property_zip: '75150',
      state: 'TX',
      is_golden_lead: true,
      lead_class: 'A',
      expected_value: 105629.61,
      notes: 'Merged duplicate lead on 2026-01-25. Score upgraded from 16 to 80.'
    })
    .eq('id', 'd95d0092-de66-41ef-a896-37df386955ec')
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Updated:', JSON.stringify(data, null, 2));
  }
}

fixDuplicate();
