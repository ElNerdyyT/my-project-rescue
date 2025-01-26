import { FunctionalComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { supabase } from '../utils/supabaseClient';
import Alert from './Alert';
import '../css/DateRangeSelector.css';

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
        setStartDate(data.start_date);
        setEndDate(data.end_date);
      }
    } catch (err) {
      console.error('Error al cargar las fechas:', err);
    }
  };

  const updateDatesInSupabase = async (startDate: string, endDate: string) => {
    try {
      const { data: existingData, error: fetchError } = await supabase
        .from('date_range')
        .select('id')
        .limit(1)
        .single();

      if (fetchError) {
        console.error('Error al obtener el registro existente:', fetchError);
        return;
      }

      if (existingData) {
        const { error } = await supabase
          .from('date_range')
          .update({ start_date: startDate, end_date: endDate })
          .eq('id', existingData.id);

        if (error) {
          console.error('Error al actualizar las fechas:', error);
        } else {
          console.log('Fechas actualizadas correctamente en Supabase');
          localStorage.setItem('alertVisible', 'true');
          window.location.reload();
        }
      } else {
        const { error } = await supabase
          .from('date_range')
          .insert([{ start_date: startDate, end_date: endDate }]);

        if (error) {
          console.error('Error al insertar el nuevo registro:', error);
        } else {
          console.log('Nuevo registro insertado correctamente');
          localStorage.setItem('alertVisible', 'true');
          window.location.reload();
        }
      }
    } catch (err) {
      console.error('Error al actualizar las fechas:', err);
    }
  };

  const handleUpdateClick = async () => {
    if (!startDate || !endDate) {
      console.error('Las fechas no pueden estar vacías');
      return;
    }
    await updateDatesInSupabase(startDate, endDate);
  };

  useEffect(() => {
    fetchDatesFromSupabase();
  }, []);

  return (
    <div class="date-range-container">
      <div class="date-range-grid">
        <div class="date-input-container">
          <label for="start-date" class="date-label">
            <span class="material-icons" aria-hidden="true">calendar_today</span>
            Fecha Inicio
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onInput={(e: Event) => setStartDate((e.target as HTMLInputElement).value)}
            class={`date-input ${!startDate ? 'invalid' : ''}`}
            aria-label="Selecciona la fecha de inicio"
            aria-invalid={!startDate}
            required
          />
          {!startDate && (
            <span class="error-message" aria-live="polite">
              Por favor selecciona una fecha de inicio
            </span>
          )}
        </div>

        <div class="date-input-container">
          <label for="end-date" class="date-label">
            <span class="material-icons" aria-hidden="true">event</span>
            Fecha Fin
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onInput={(e: Event) => setEndDate((e.target as HTMLInputElement).value)}
            class={`date-input ${!endDate ? 'invalid' : ''}`}
            aria-label="Selecciona la fecha de fin"
            aria-invalid={!endDate}
            required
          />
          {!endDate && (
            <span class="error-message" aria-live="polite">
              Por favor selecciona una fecha de fin
            </span>
          )}
        </div>

        <button 
          class="update-button"
          onClick={handleUpdateClick}
          disabled={!startDate || !endDate}
          aria-disabled={!startDate || !endDate}
        >
          <span class="material-icons" aria-hidden="true">update</span>
          Actualizar Fechas
        </button>
      </div>

      <Alert />
    </div>
  );
};

export default DateRangeSelector;
