// --- START OF FILE DateRangeSelector.tsx ---
// No changes needed here based on the request, assuming the original code is correct.
// The styling adjustments will be handled in the CSS files.

import { FunctionalComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import Alert from './Alert';
import '../css/DateRangeSelector.css'; // Ensure this CSS file exists and is linked

const DateRangeSelector: FunctionalComponent = () => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchDatesFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('date_range')
        .select('start_date, end_date')
        .limit(1)
        .single();

      if (error) {
        console.error('Error al obtener las fechas desde Supabase:', error);
        return;
      }

      if (data) {
        setStartDate(data.start_date || ''); // Ensure empty string if null
        setEndDate(data.end_date || ''); // Ensure empty string if null
      }
    } catch (err) {
      console.error('Error al cargar las fechas:', err);
    }
  };

  const updateDatesInSupabase = async (startDate: string, endDate: string) => {
    // Check if dates are valid before proceeding
    if (!startDate || !endDate) {
       console.error('Las fechas de inicio y fin son requeridas.');
       // Optionally show a user-facing error message here
       return;
    }
    if (new Date(startDate) > new Date(endDate)) {
        console.error('La fecha de inicio no puede ser posterior a la fecha de fin.');
        // Optionally show a user-facing error message here
        return;
    }

    try {
      // Attempt to fetch existing record first to decide between UPDATE and INSERT
      // This avoids potential issues if the table is empty initially
      const { data: existingData, error: fetchError } = await supabase
        .from('date_range')
        .select('id')
        .limit(1)
        .maybeSingle(); // Use maybeSingle to handle null case gracefully

      // Handle potential fetch errors (excluding 'No rows found' which is okay)
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: Range request returned no rows
         console.error('Error al verificar el registro existente:', fetchError);
         // Optionally show a user-facing error
         return;
      }

      let operationError: any = null;

      if (existingData) {
        // Record exists, perform UPDATE
        const { error } = await supabase
          .from('date_range')
          .update({ start_date: startDate, end_date: endDate })
          .eq('id', existingData.id); // Use the fetched ID
         operationError = error;
         if (!error) console.log('Fechas actualizadas correctamente en Supabase');

      } else {
        // No record exists, perform INSERT
        const { error } = await supabase
          .from('date_range')
          .insert([{ start_date: startDate, end_date: endDate }]);
         operationError = error;
         if (!error) console.log('Nuevo registro insertado correctamente');
      }

      // Handle errors from UPDATE or INSERT
      if (operationError) {
        console.error('Error al guardar las fechas:', operationError);
        // Optionally show a user-facing error
      } else {
        // Success: Show alert and reload (consider if reload is truly needed)
        localStorage.setItem('alertVisible', 'true');
        // Consider using state management instead of full reload for better UX
        window.location.reload();
      }

    } catch (err) {
      console.error('Error inesperado al actualizar las fechas:', err);
      // Optionally show a user-facing error
    }
  };

  const handleUpdateClick = async () => {
    // Basic validation moved inside updateDatesInSupabase
    await updateDatesInSupabase(startDate, endDate);
  };

  useEffect(() => {
    fetchDatesFromSupabase();
  }, []);

  // Determine if button should be disabled
  const isInvalidRange = !startDate || !endDate || new Date(startDate) > new Date(endDate);


  return (
    // Removed outer container div, assuming the parent (.top-bar-date-selector in Menu.tsx) handles positioning
    <div class="date-range-selector-inline">
      <div class="date-input-group">
        <label for="start-date" class="date-label sr-only"> {/* Screen-reader only label */}
          Fecha Inicio
        </label>
        <span class="material-icons date-icon" aria-hidden="true">calendar_today</span>
        <input
          id="start-date"
          type="date"
          value={startDate}
          onInput={(e: Event) => setStartDate((e.target as HTMLInputElement).value)}
          class={`date-input ${!startDate ? 'invalid' : ''}`}
          aria-label="Fecha de inicio" // More descriptive aria-label
          aria-invalid={!startDate}
          required
        />
        {/* {!startDate && ( // Consider removing visual error message here for compactness
          <span class="error-message" aria-live="polite">
            Requerido
          </span>
        )} */}
      </div>

      <div class="date-input-group">
        <label for="end-date" class="date-label sr-only"> {/* Screen-reader only label */}
          Fecha Fin
        </label>
        <span class="material-icons date-icon" aria-hidden="true">event</span>
        <input
          id="end-date"
          type="date"
          value={endDate}
          onInput={(e: Event) => setEndDate((e.target as HTMLInputElement).value)}
          class={`date-input ${!endDate ? 'invalid' : ''}`}
          aria-label="Fecha de fin" // More descriptive aria-label
          aria-invalid={!endDate}
          required
        />
         {/* {!endDate && ( // Consider removing visual error message here for compactness
          <span class="error-message" aria-live="polite">
            Requerido
          </span>
        )} */}
      </div>

      <button
        class="update-button"
        onClick={handleUpdateClick}
        disabled={isInvalidRange}
        aria-disabled={isInvalidRange}
        title={isInvalidRange ? "Selecciona fechas válidas (inicio no puede ser mayor que fin)" : "Actualizar rango de fechas"} // Add title for usability
      >
        <span class="material-icons" aria-hidden="true">update</span>
        <span class="sr-only">Actualizar Fechas</span> {/* Screen-reader only text */}
      </button>

      {/* Alert component might need separate styling consideration if it appears inline */}
      <Alert />
    </div>
  );
};

export default DateRangeSelector;