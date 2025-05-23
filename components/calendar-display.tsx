"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Calendar, Download, Save, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { ViewToggle } from "@/components/view-toggle"
import { ExamListView } from "@/components/exam-list-view"
import { getExams } from "@/actions/exam-actions"
import { formatDateString, getCurrentYear, getAcademicYearForMonth } from "@/utils/date-utils"
import { SaveCalendarDialog } from "@/components/save-calendar-dialog"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import styles from "@/styles/tooltip.module.css"
import { saveUserCalendar, getUserCalendarNames } from "@/actions/user-calendars"
import { extractTokensFromStorage } from "@/lib/auth/token-manager"

// Generate month data dynamically
const generateMonths = () => {
  const currentYear = getCurrentYear();
  const months = [];
  
  for (let month = 0; month < 12; month++) {
    const firstDayOfMonth = new Date(currentYear, month, 1);
    const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
    
    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    // Convert to Monday-first format (0 = Monday, ..., 6 = Sunday)
    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay === -1) startDay = 6; // Sunday becomes 6 in Monday-first format
    
    months.push({
      name: firstDayOfMonth.toLocaleString('default', { month: 'long' }),
      days: daysInMonth,
      startDay: startDay
    });
  }
  
  return months;
};

export function CalendarDisplay({ activeFilters = {} }: { activeFilters?: Record<string, string[]> }) {
  const [selectedDay, setSelectedDay] = useState<{ month: string; day: number } | null>(null)
  const [selectedExams, setSelectedExams] = useState<any[]>([])
  const [visibleMonths, setVisibleMonths] = useState<number[]>([8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7])
  const [view, setView] = useState<"calendar" | "list">("calendar")
  const [exams, setExams] = useState<any[]>([])
  const [months, setMonths] = useState(generateMonths()) // Show all 12 months
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [existingNames, setExistingNames] = useState<string[]>([])
  const { user, syncToken } = useAuth()
  const { toast } = useToast()
  
  // Check if ETSINF is in the schools filter
  const hasETSINFFilter = activeFilters?.school?.includes("ETSINF")
  
  // Log the active filters to debug
  useEffect(() => {
    console.log("CalendarDisplay - Active Filters:", activeFilters);
    console.log("ETSINF Filter Active:", hasETSINFFilter);
  }, [activeFilters, hasETSINFFilter]);

  // Fetch exams when filters change
  useEffect(() => {
    const fetchExams = async () => {
      try {
        console.log("CalendarDisplay - Fetching exams with filters:", activeFilters);
        // Pass filters directly to getExams
        const data = await getExams(activeFilters)
        console.log(`CalendarDisplay - Fetched ${data.length} exams. Sample:`, data.slice(0, 2)); 
        
        // For debugging - log all unique dates in the exam data
        if (data.length > 0) {
          const uniqueDates = [...new Set(data.map(exam => exam.date))].sort();
          console.log("CalendarDisplay - Unique exam dates:", uniqueDates);
          
          // No longer automatically select the first exam date
        }
        
        setExams(data)
      } catch (error) {
        console.error("CalendarDisplay - Error fetching exams:", error);
        setExams([])
      }
    }
    
    fetchExams()
  }, [activeFilters])

  // Fetch existing calendar names when the component mounts or user changes
  useEffect(() => {
    const fetchCalendarNames = async () => {
      if (user?.id) {
        try {
          const names = await getUserCalendarNames(user.id);
          setExistingNames(names);
        } catch (error) {
          console.error("Error fetching calendar names:", error);
        }
      }
    };
    
    fetchCalendarNames();
  }, [user?.id]);

  const handleDayClick = (month: string, day: number) => {
    const newSelection = { month, day }
    setSelectedDay(newSelection)

    // Find exams for this day
    const monthIndex = months.findIndex((m) => m.name === month) + 1
    const year = getAcademicYearForMonth(monthIndex)
    const dateString = formatDateString(year, monthIndex, day);

    const dayExams = exams.filter((exam) => exam.date === dateString)
    console.log(`CalendarDisplay - Found ${dayExams.length} exams for ${dateString}:`, dayExams);
    setSelectedExams(dayExams)
  }

  const hasExam = (month: string, day: number) => {
    const monthIndex = months.findIndex((m) => m.name === month) + 1
    const year = getAcademicYearForMonth(monthIndex)
    const dateString = formatDateString(year, monthIndex, day);

    const hasExamsForDay = exams.some((exam) => exam.date === dateString)
    return hasExamsForDay
  }

  const showPreviousMonths = () => {
    if (visibleMonths[0] > 0) {
      setVisibleMonths(visibleMonths.map((m) => m - 1))
    }
  }

  const showNextMonths = () => {
    if (visibleMonths[visibleMonths.length - 1] < months.length - 1) {
      setVisibleMonths(visibleMonths.map((m) => m + 1))
    }
  }

  // Open save dialog if user is logged in, otherwise show login toast
  const openSaveDialog = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to save calendars",
        variant: "destructive",
      });
      return;
    }
    setSaveDialogOpen(true);
  };

  // Save calendar view function
  const handleSaveCalendar = async (name: string) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to save calendars",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log("Saving calendar with user ID:", user.id);
      
      // First, sync auth tokens to ensure we have the latest state
      console.log("⏳ Synchronizing authentication state...");
      await syncToken();
      
      // Get both auth tokens using the token manager
      const { accessToken, refreshToken } = extractTokensFromStorage();
      
      // Verify tokens were found
      if (!accessToken || !refreshToken) {
        console.error("❌ Missing auth tokens:", {
          accessToken: !!accessToken,
          refreshToken: !!refreshToken
        });
        throw new Error("Authentication error: Missing tokens. Please log in again.");
      }
      
      console.log("✅ Found auth tokens - preparing to save calendar");
      
      // Pass both tokens directly to the server action
      const response = await saveUserCalendar({
        name,
        filters: activeFilters,
        userId: user.id,
        accessToken,
        refreshToken
      });
      
      if (!response) {
        throw new Error("Failed to save calendar: Server returned empty response");
      }
      
      console.log("✅ Server response:", response);
      
      // Update the list of existing names
      setExistingNames(prev => [...prev, name]);
      
      toast({
        title: "Calendar saved",
        description: `Your calendar "${name}" has been saved successfully.`,
      });
    } catch (error: any) {
      console.error("Error saving calendar:", error);
      
      // Get a more descriptive error message if available
      const errorMessage = typeof error === 'string' ? error : 
                          error?.message || 
                          "An error occurred while saving your calendar. Please try again.";
      
      // If it's an authentication error, provide specific guidance
      if (errorMessage.includes("authentication") || 
          errorMessage.includes("log in") || 
          errorMessage.includes("session") ||
          errorMessage.includes("token")) {
        toast({
          title: "Authentication error",
          description: "Please log out and log in again to refresh your session.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error saving calendar",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Exam Calendar</h2>
          <p className="text-sm text-muted-foreground">Found {exams.length} exams for the selected period</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle view={view} onChange={setView} />

          <div className="hidden sm:flex sm:gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-10 gap-1.5 rounded-md"
              onClick={openSaveDialog}
            >
              <Save className="h-4 w-4" />
              <span>Save View</span>
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-md">
              <Calendar className="h-4 w-4" />
              <span>Google Calendar</span>
            </Button>
            <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-md">
              <Download className="h-4 w-4" />
              <span>iCal Export</span>
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 sm:hidden">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openSaveDialog}>
                <Save className="mr-2 h-4 w-4" />
                <span>Save View</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Calendar className="mr-2 h-4 w-4" />
                <span>Google Calendar</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                <span>iCal Export</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Add SaveCalendarDialog component */}
      <SaveCalendarDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        filters={activeFilters}
        onSave={handleSaveCalendar}
        existingNames={existingNames}
      />

      <AnimatePresence mode="wait">
        {view === "calendar" ? (
          <motion.div
            key="calendar-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <TooltipProvider>
                {visibleMonths.map((monthIndex) => {
                  const month = months[monthIndex]
                  return (
                    <Card key={month.name} className="overflow-hidden transition-all duration-300 hover:shadow-lg">
                      <CardHeader className="bg-muted/30 py-4">
                        <CardTitle className="text-center text-lg font-medium tracking-tight">{month.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium">
                          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
                            <div key={day} className="py-1">
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
                          {Array.from({ length: month.startDay }).map((_, i) => (
                            <div key={`empty-start-${i}`} className="rounded-md bg-muted/30 p-2"></div>
                          ))}

                          {Array.from({ length: month.days }).map((_, i) => {
                            const day = i + 1
                            const isSelected = selectedDay?.month === month.name && selectedDay?.day === day
                            const dayHasExam = hasExam(month.name, day)

                            return (
                              <Tooltip key={`day-${day}`} delayDuration={150}>
                                <TooltipTrigger asChild>
                                  <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    transition={{ duration: 0.1 }}
                                    className={`relative rounded-md p-2 transition-all ${
                                      isSelected
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : dayHasExam
                                          ? "bg-primary/10 font-medium text-primary"
                                          : "hover:bg-accent"
                                    }`}
                                    title={`${month.name} ${day}, ${getAcademicYearForMonth(months.findIndex(m => m.name === month.name) + 1)}${dayHasExam ? ' - Has exams' : ''}`}
                                  >
                                    {day}
                                    {dayHasExam && (
                                      <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary"></span>
                                    )}
                                  </motion.div>
                                </TooltipTrigger>
                                {dayHasExam && (
                                  <TooltipContent
                                    side="top"
                                    align="center"
                                    className={styles.examTooltip}
                                    sideOffset={8}
                                    avoidCollisions={true}
                                  >
                                    <div className="p-0">
                                      <div className="bg-primary/10 px-3 py-2 text-xs font-medium text-primary flex items-center justify-between border-b border-primary/10">
                                        <span>{month.name} {day}, {getAcademicYearForMonth(months.findIndex(m => m.name === month.name) + 1)}</span>
                                        <span className={styles.examCount}>
                                          {exams.filter(exam => {
                                            const monthIndex = months.findIndex(m => m.name === month.name) + 1;
                                            const year = getAcademicYearForMonth(monthIndex);
                                            const dateString = formatDateString(year, monthIndex, day);
                                            return exam.date === dateString;
                                          }).length} exams
                                        </span>
                                      </div>
                                      
                                      <div className={styles.scrollArea}>
                                        <div className="p-2">
                                          {exams
                                            .filter(exam => {
                                              const monthIndex = months.findIndex(m => m.name === month.name) + 1;
                                              const year = getAcademicYearForMonth(monthIndex);
                                              const dateString = formatDateString(year, monthIndex, day);
                                              return exam.date === dateString;
                                            })
                                            .map(exam => (
                                              <div
                                                key={exam.id}
                                                className={styles.examCard}
                                              >
                                                <div className="mb-1 font-medium">{exam.subject}</div>
                                                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                                                  <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {exam.time}
                                                  </span>
                                                  <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {exam.location || 'No location'}
                                                  </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                  {exam.school && (
                                                    <Badge variant="outline" className="text-xs">
                                                      {exam.school}
                                                    </Badge>
                                                  )}
                                                  {exam.degree && (
                                                    <Badge variant="outline" className="text-xs">
                                                      {exam.degree}
                                                    </Badge>
                                                  )}
                                                  <Badge variant="outline" className="text-xs">
                                                    {exam.year || '?'} Year
                                                  </Badge>
                                                  <Badge variant="outline" className="text-xs">
                                                    Sem. {exam.semester || '?'}
                                                  </Badge>
                                                  {exam.code && (
                                                    <Badge variant="secondary" className="text-xs">
                                                      Code: {exam.code}
                                                    </Badge>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                            
                                          {exams.filter(exam => {
                                            const monthIndex = months.findIndex(m => m.name === month.name) + 1;
                                            const year = getAcademicYearForMonth(monthIndex);
                                            const dateString = formatDateString(year, monthIndex, day);
                                            return exam.date === dateString;
                                          }).length === 0 && (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                              No exam details available
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            )
                          })}

                          {Array.from({ length: (7 - ((month.startDay + month.days) % 7)) % 7 }).map((_, i) => (
                            <div key={`empty-end-${i}`} className="rounded-md bg-muted/30 p-2"></div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </TooltipProvider>
            </div>

            <div className="mt-8 rounded-lg border bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-medium">Upcoming Exams Summary</h3>
              
              {exams.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {exams
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort by date ascending
                      .slice(0, 6) // Show first 6 upcoming exams
                      .map(exam => (
                        <div key={exam.id} className={styles.examCard}>
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">{exam.subject}</span>
                            <Badge variant="outline">{new Date(exam.date).toLocaleDateString()}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {exam.time}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {exam.location || 'No location'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {exam.year} Year
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              Sem. {exam.semester}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                  
                  {exams.length > 6 && (
                    <div className="flex justify-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setView("list")}
                        className="mt-2"
                      >
                        View All {exams.length} Exams
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-4 opacity-20" />
                  <p>No exams found for the selected filters.</p>
                  <p className="text-sm mt-2">Try adjusting your filter criteria to see exams.</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ExamListView activeFilters={activeFilters} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function MoreHorizontal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  )
}
