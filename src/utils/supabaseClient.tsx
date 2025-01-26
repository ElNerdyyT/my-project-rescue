
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ysdtakaxwcrlklitumbp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZHRha2F4d2NybGtsaXR1bWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY2NDAzMTEsImV4cCI6MjA1MjIxNjMxMX0.bttzUZW6vXqBHYd9C1_hWxgXDOtQ9Rc6-TQry8sS2dw';
export const supabase = createClient(supabaseUrl, supabaseKey); 
        