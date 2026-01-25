const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tidcqvhxdsbnfykbvygs.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDuplicate() {
  // First, let's check the current state of the lead
  const { data: lead, error: fetchError } = await supabase
    .from('maxsam_leads')
    .select('*')
    .eq('id', 'd95d0092-de66-41ef-a896-37df386955ec')
    .single();

  if (fetchError) {
    console.error('Error fetching lead:', fetchError);
    return;
  }

  console.log('Current lead state:', JSON.stringify(lead, null, 2));

  // Update with minimal fields to avoid trigger issues
  // The lead already has the real phone from SMS messages
  // Just need to update score-related fields
  const { data, error } = await supabase
    .from('maxsam_leads')
    .update({
      eleanor_score: 80,
      notes: 'Merged duplicate lead on 2026-01-25. Score upgraded from 16 to 80. Excess funds: $105,629.61'
    })
    .eq('id', 'd95d0092-de66-41ef-a896-37df386955ec')
    .select();

  if (error) {
    console.error('Error updating lead:', error);
    // Try an even simpler update
    console.log('Trying simpler update...');
    const { data: data2, error: error2 } = await supabase
      .from('maxsam_leads')
      .update({ notes: 'Score: 80. Merged duplicate 2026-01-25.' })
      .eq('id', 'd95d0092-de66-41ef-a896-37df386955ec')
      .select();

    if (error2) {
      console.error('Simple update also failed:', error2);
    } else {
      console.log('Simple update succeeded:', JSON.stringify(data2, null, 2));
    }
  } else {
    console.log('Updated successfully:', JSON.stringify(data, null, 2));
  }
}

fixDuplicate();
