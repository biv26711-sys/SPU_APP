import { useEffect, useRef } from 'react';

const AUTOSAVE_INTERVAL = 5 * 60 * 1000; 
const STORAGE_KEY = 'spu_project_autosave';

export const useAutosave = (project, calculationResults) => {
  const intervalRef = useRef(null);
  const lastSaveRef = useRef(null);

  useEffect(() => {
    const saveData = () => {
      try {
        const dataToSave = {
          project,
          calculationResults,
          timestamp: new Date().toISOString(),
          version: '1.0'
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        lastSaveRef.current = new Date();
        
        console.log('Проект автоматически сохранен:', new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Ошибка автосохранения:', error);
      }
    };

    if (project.tasks.length > 0) {
      saveData();
    }

    intervalRef.current = setInterval(saveData, AUTOSAVE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [project, calculationResults]);

  const loadAutosavedData = () => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        return {
          project: parsed.project,
          calculationResults: parsed.calculationResults,
          timestamp: parsed.timestamp,
          version: parsed.version
        };
      }
    } catch (error) {
      console.error('Ошибка загрузки автосохраненных данных:', error);
    }
    return null;
  };

  const clearAutosavedData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Ошибка очистки автосохраненных данных:', error);
    }
  };

  const hasAutosavedData = () => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch (error) {
      return false;
    }
  };

  return {
    loadAutosavedData,
    clearAutosavedData,
    hasAutosavedData,
    lastSave: lastSaveRef.current
  };
};

export default useAutosave;

