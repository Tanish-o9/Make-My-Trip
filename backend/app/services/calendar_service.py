import datetime
from typing import Dict, Any

class CalendarService:
    @staticmethod
    def generate_ics_content(event: Dict[str, Any]) -> str:
        """
        Generates standard RFC 5545 iCalendar content.
        event details include:
        - summary (e.g. Flight to Goa)
        - description (e.g. flight number details)
        - location (e.g. Delhi Airport T3)
        - start_time (datetime.datetime)
        - end_time (datetime.datetime)
        - uid (unique id string)
        """
        summary = event.get("summary", "Travel Booking")
        description = event.get("description", "Details not provided")
        location = event.get("location", "Not specified")
        start = event.get("start_time", datetime.datetime.utcnow())
        end = event.get("end_time", start + datetime.timedelta(hours=2))
        uid = event.get("uid", f"uid_{int(start.timestamp())}@travelos.com")

        # Format datetimes in UTC format: YYYYMMDDTHHMMSSZ
        dtstamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        dtstart = start.strftime("%Y%m%dT%H%M%SZ")
        dtend = end.strftime("%Y%m%dT%H%M%SZ")

        ics_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Ghumne Chale//Itinerary Generator//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART:{dtstart}",
            f"DTEND:{dtend}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            f"LOCATION:{location}",
            "STATUS:CONFIRMED",
            "SEQUENCE:0",
            "END:VEVENT",
            "END:VCALENDAR"
        ]

        return "\r\n".join(ics_lines)
