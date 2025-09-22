import React from 'react';

const StickyPhaseHeader = ({ phase, title }) => {
  return (
    <div className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 p-2 my-2 rounded-md shadow-sm">
      <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">
        <span className="text-blue-500">{phase}:</span> {title}
      </h3>
    </div>
  );
};

export default StickyPhaseHeader;


