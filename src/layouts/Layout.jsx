import React from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Zap } from 'lucide-react';

const Layout = () => {
    return (
        <div className="min-h-screen bg-kepco-light font-sans text-kepco-navy">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo Area */}
                        <div className="flex items-center gap-2">
                            <div className="bg-kepco-navy p-1.5 rounded-lg">
                                <Zap className="h-6 w-6 text-kepco-blue" fill="currentColor" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-heading font-bold text-lg leading-tight tracking-tight text-kepco-navy">KEPCO</span>
                                <span className="text-[10px] font-semibold tracking-wider text-kepco-gray uppercase leading-none">Daegu Headquarters</span>
                            </div>
                        </div>

                        {/* Mobile Menu Button (Placeholder) */}
                        <button className="p-2 rounded-md hover:bg-gray-100 transition-colors md:hidden">
                            <Menu className="h-6 w-6 text-kepco-navy" />
                        </button>

                        {/* Desktop Nav (Optional) */}
                        <div className="hidden md:flex items-center space-x-4">
                            <span className="text-sm font-medium text-kepco-gray">Schedule Management System</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
