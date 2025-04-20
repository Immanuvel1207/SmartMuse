import React, { useState } from 'react';
import MuseumDashboard from './components/MuseumDashboard';

const App = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    return (
        // <div>
        //     {!isLoggedIn ? (
        //         <AdminLogin onLogin={setIsLoggedIn} />
        //     ) : (
        //         <AdminHome />
        //     )}
        // </div>
        <div><MuseumDashboard/></div>
    );
};

export default App;
