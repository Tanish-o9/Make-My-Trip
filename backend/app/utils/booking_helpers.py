import os
import qrcode
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# Ensure dirs exist
os.makedirs("static/qrcodes", exist_ok=True)
os.makedirs("static/tickets", exist_ok=True)

def generate_qr_code(booking_ref: str) -> str:
    # Front-end details url: http://localhost:5173/booking/{booking_ref}
    url = f"http://localhost:5173/booking/{booking_ref}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    path = f"static/qrcodes/{booking_ref}.png"
    img.save(path)
    return f"/static/qrcodes/{booking_ref}.png"

def generate_booking_pdf(booking, ticket, invoice, user, vertical: str) -> str:
    pdf_path = f"static/tickets/{booking.booking_reference}.pdf"
    doc = SimpleDocTemplate(pdf_path, pagesize=letter,
                            rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        textColor=colors.HexColor('#2563eb'), # Blue 600
        spaceBefore=10,
        spaceAfter=10
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#334155'), # Slate 700
        leading=13
    )

    body_bold = ParagraphStyle(
        'BodyDarkBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    # 1. Header Row (Logo / Ghumne Chale Branding + QR)
    qr_img_path = f"static/qrcodes/{booking.booking_reference}.png"
    if not os.path.exists(qr_img_path):
        generate_qr_code(booking.booking_reference)
        
    qr_img = Image(qr_img_path, width=1.1*inch, height=1.1*inch)
    
    header_data = [
        [
            Paragraph("GHUMNE CHALE", ParagraphStyle('LogoText', fontName='Helvetica-Bold', fontSize=22, textColor=colors.HexColor('#2563eb'))),
            qr_img
        ],
        [
            Paragraph("Autonomous Travel Booking Confirmation Document", ParagraphStyle('SubText', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#64748b'))),
            Paragraph(f"Ref: <b>{booking.booking_reference}</b>", body_style)
        ]
    ]
    
    header_table = Table(header_data, colWidths=[5.4*inch, 1.6*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,1), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))
    
    # 2. General Booking Info Table
    story.append(Paragraph("BOOKING METADATA", section_style))
    info_data = [
        [Paragraph("Booking Date", body_bold), Paragraph(booking.created_at.strftime('%Y-%m-%d %H:%M:%S') if booking.created_at else "Now", body_style),
         Paragraph("Status", body_bold), Paragraph(booking.status.value.upper(), ParagraphStyle('StatusStyle', parent=body_style, fontName='Helvetica-Bold', textColor=colors.HexColor('#16a34a') if booking.status.value == 'confirmed' else colors.HexColor('#ca8a04')))],
        [Paragraph("Customer Name", body_bold), Paragraph(getattr(user, "name", "") or getattr(user, "username", "Guest") if user else "Guest", body_style),
         Paragraph("Customer Email", body_bold), Paragraph(getattr(user, "email", "guest@travelos.com") if user else "guest@travelos.com", body_style)]
    ]
    info_table = Table(info_data, colWidths=[1.5*inch, 2.0*inch, 1.5*inch, 2.0*inch])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 10))

    # 3. Vertical details
    story.append(Paragraph("ITINERARY DETAILS", section_style))
    
    itinerary_data = []
    if vertical == "flights":
        itinerary_data = [
            [Paragraph("Airline", body_bold), Paragraph(getattr(booking, 'airline_code', '6E'), body_style),
             Paragraph("Flight Number", body_bold), Paragraph(getattr(booking, 'flight_number', '101'), body_style)],
            [Paragraph("Origin Airport", body_bold), Paragraph(getattr(booking, 'origin', 'DEL'), body_style),
             Paragraph("Destination Airport", body_bold), Paragraph(getattr(booking, 'destination', 'GOI'), body_style)],
            [Paragraph("Departure Time", body_bold), Paragraph(booking.departure_time.strftime('%Y-%m-%d %H:%M:%S') if hasattr(booking, 'departure_time') else '—', body_style),
             Paragraph("Arrival Time", body_bold), Paragraph(booking.arrival_time.strftime('%Y-%m-%d %H:%M:%S') if hasattr(booking, 'arrival_time') else '—', body_style)],
            [Paragraph("Cabin Class", body_bold), Paragraph(getattr(booking, 'cabin_class', 'ECONOMY').upper(), body_style),
             Paragraph("PNR", body_bold), Paragraph(ticket.pnr or "—", body_style)]
        ]
    elif vertical == "hotels":
        itinerary_data = [
            [Paragraph("Hotel Name", body_bold), Paragraph(getattr(booking, 'hotel_name', 'Grand Hyatt'), body_style),
             Paragraph("Room Type", body_bold), Paragraph(getattr(booking, 'room_type', 'Deluxe Room'), body_style)],
            [Paragraph("Check-In Date", body_bold), Paragraph(booking.check_in.strftime('%Y-%m-%d %H:%M:%S') if hasattr(booking, 'check_in') else '—', body_style),
             Paragraph("Check-Out Date", body_bold), Paragraph(booking.check_out.strftime('%Y-%m-%d %H:%M:%S') if hasattr(booking, 'check_out') else '—', body_style)],
            [Paragraph("Address", body_bold), Paragraph(getattr(booking, 'address', 'Goa Beachfront'), body_style),
             Paragraph("Reservation ID", body_bold), Paragraph(booking.booking_reference, body_style)]
        ]
    elif vertical == "trains":
        itinerary_data = [
            [Paragraph("Train Number", body_bold), Paragraph(getattr(booking, 'train_number', '12001'), body_style),
             Paragraph("Train Name", body_bold), Paragraph(getattr(booking, 'train_name', 'Shatabdi Exp'), body_style)],
            [Paragraph("Origin Station", body_bold), Paragraph(getattr(booking, 'origin_station', 'NDLS'), body_style),
             Paragraph("Destination", body_bold), Paragraph(getattr(booking, 'destination_station', 'BCT'), body_style)],
            [Paragraph("Departure Time", body_bold), Paragraph(booking.departure_time.strftime('%Y-%m-%d %H:%M:%S') if hasattr(booking, 'departure_time') else '—', body_style),
             Paragraph("Coach Class", body_bold), Paragraph(getattr(booking, 'coach_class', 'CC'), body_style)],
            [Paragraph("PNR", body_bold), Paragraph(ticket.pnr or "—", body_style),
             Paragraph("Status", body_bold), Paragraph(booking.status.value.upper(), body_style)]
        ]
    elif vertical == "buses":
        itinerary_data = [
            [Paragraph("Bus Operator", body_bold), Paragraph(getattr(booking, 'operator_name', 'Volvo Travels'), body_style),
             Paragraph("Bus Type", body_bold), Paragraph(getattr(booking, 'bus_type', 'AC Sleeper'), body_style)],
            [Paragraph("Origin", body_bold), Paragraph(getattr(booking, 'origin', 'Delhi'), body_style),
             Paragraph("Destination", body_bold), Paragraph(getattr(booking, 'destination', 'Jaipur'), body_style)],
            [Paragraph("Departure Time", body_bold), Paragraph(booking.departure_time.strftime('%Y-%m-%d %H:%M:%S') if hasattr(booking, 'departure_time') else '—', body_style),
             Paragraph("Seats Assigned", body_bold), Paragraph(", ".join(getattr(booking, 'seat_numbers', [])) if isinstance(getattr(booking, 'seat_numbers', None), list) else str(getattr(booking, 'seat_numbers', '—')), body_style)]
        ]
    elif vertical == "cabs":
        itinerary_data = [
            [Paragraph("Cab Provider", body_bold), Paragraph(getattr(booking, 'provider_name', 'Ghumne Chale Cab'), body_style),
             Paragraph("Cab Type", body_bold), Paragraph(getattr(booking, 'cab_type', 'Sedan'), body_style)],
            [Paragraph("Pickup Address", body_bold), Paragraph(getattr(booking, 'pickup_address', '—'), body_style),
             Paragraph("Drop Address", body_bold), Paragraph(getattr(booking, 'drop_address', '—'), body_style)],
            [Paragraph("Pickup Time", body_bold), Paragraph(booking.pickup_time.strftime('%Y-%m-%d %H:%M:%S') if hasattr(booking, 'pickup_time') else '—', body_style),
             Paragraph("Status", body_bold), Paragraph(booking.status.value.upper(), body_style)]
        ]
    elif vertical == "visa":
        itinerary_data = [
            [Paragraph("Country", body_bold), Paragraph(getattr(booking, 'country', 'USA'), body_style),
             Paragraph("Visa Type", body_bold), Paragraph(getattr(booking, 'visa_type', 'Tourist'), body_style)],
            [Paragraph("Application ID", body_bold), Paragraph(booking.booking_reference, body_style),
             Paragraph("Status", body_bold), Paragraph(booking.status.value.upper(), body_style)]
        ]
    elif vertical == "holidays":
        itinerary_data = [
            [Paragraph("Package Name", body_bold), Paragraph(getattr(booking, 'package_name', 'Goa Holiday'), body_style),
             Paragraph("Destination", body_bold), Paragraph(getattr(booking, 'destination', 'Goa'), body_style)],
            [Paragraph("Start Date", body_bold), Paragraph(booking.start_date.strftime('%Y-%m-%d') if hasattr(booking, 'start_date') else '—', body_style),
             Paragraph("End Date", body_bold), Paragraph(booking.end_date.strftime('%Y-%m-%d') if hasattr(booking, 'end_date') else '—', body_style)]
        ]
    elif vertical == "tours":
        itinerary_data = [
            [Paragraph("Activity Name", body_bold), Paragraph(getattr(booking, 'activity_name', 'Sightseeing'), body_style),
             Paragraph("Location", body_bold), Paragraph(getattr(booking, 'location', '—'), body_style)],
            [Paragraph("Activity Time", body_bold), Paragraph(booking.activity_time.strftime('%Y-%m-%d %H:%M') if hasattr(booking, 'activity_time') else '—', body_style),
             Paragraph("Status", body_bold), Paragraph(booking.status.value.upper(), body_style)]
        ]
    elif vertical == "cruises":
        itinerary_data = [
            [Paragraph("Cruise Line", body_bold), Paragraph(getattr(booking, 'cruise_line', 'Royal Caribbean'), body_style),
             Paragraph("Ship Name", body_bold), Paragraph(getattr(booking, 'ship_name', 'Majesty of the Seas'), body_style)],
            [Paragraph("Departure Port", body_bold), Paragraph(getattr(booking, 'departure_port', 'Miami'), body_style),
             Paragraph("Arrival Port", body_bold), Paragraph(getattr(booking, 'arrival_port', 'Nassau'), body_style)],
            [Paragraph("Departure Time", body_bold), Paragraph(booking.departure_time.strftime('%Y-%m-%d %H:%M') if hasattr(booking, 'departure_time') else '—', body_style),
             Paragraph("Status", body_bold), Paragraph(booking.status.value.upper(), body_style)]
        ]
    elif vertical == "insurance":
        itinerary_data = [
            [Paragraph("Policy Name", body_bold), Paragraph(getattr(booking, 'policy_name', 'Travel Guard'), body_style),
             Paragraph("Policy Number", body_bold), Paragraph(getattr(booking, 'policy_number', 'TG-12345'), body_style)],
            [Paragraph("Provider Name", body_bold), Paragraph(getattr(booking, 'provider_name', 'AIG'), body_style),
             Paragraph("Start Date", body_bold), Paragraph(booking.start_date.strftime('%Y-%m-%d') if hasattr(booking, 'start_date') else '—', body_style)]
        ]
    elif vertical == "villas":
        itinerary_data = [
            [Paragraph("Villa Name", body_bold), Paragraph(getattr(booking, 'villa_name', 'Villa Vista'), body_style),
             Paragraph("Bedrooms", body_bold), Paragraph(str(getattr(booking, 'bedrooms', 3)), body_style)],
            [Paragraph("Check-In", body_bold), Paragraph(booking.check_in.strftime('%Y-%m-%d') if hasattr(booking, 'check_in') else '—', body_style),
             Paragraph("Check-Out", body_bold), Paragraph(booking.check_out.strftime('%Y-%m-%d') if hasattr(booking, 'check_out') else '—', body_style)],
            [Paragraph("Address", body_bold), Paragraph(getattr(booking, 'address', '—'), body_style),
             Paragraph("Status", body_bold), Paragraph(booking.status.value.upper(), body_style)]
        ]
    elif vertical == "forex":
        itinerary_data = [
            [Paragraph("Currency Pair", body_bold), Paragraph(getattr(booking, 'currency_pair', 'USD/INR'), body_style),
             Paragraph("Delivery Mode", body_bold), Paragraph(getattr(booking, 'delivery_mode', 'Home Delivery'), body_style)],
            [Paragraph("Rate Locked At", body_bold), Paragraph(str(getattr(booking, 'rate_locked_at_order', '—')), body_style),
             Paragraph("Status", body_bold), Paragraph(booking.status.value.upper(), body_style)]
        ]
    elif vertical in ["rent-a-ride", "vehicle_rental"]:
        itinerary_data = [
            [Paragraph("Vehicle Name", body_bold), Paragraph(getattr(booking, 'vehicle_name', 'Honda City'), body_style),
             Paragraph("Vehicle Type", body_bold), Paragraph(getattr(booking, 'vehicle_type', 'Sedan'), body_style)],
            [Paragraph("City", body_bold), Paragraph(getattr(booking, 'city', 'Delhi'), body_style),
             Paragraph("Pickup Time", body_bold), Paragraph(booking.pickup_time.strftime('%Y-%m-%d %H:%M') if hasattr(booking, 'pickup_time') else '—', body_style)]
        ]
    else:
        itinerary_data = [
            [Paragraph("Vertical type", body_bold), Paragraph(vertical.upper(), body_style),
             Paragraph("Booking Reference", body_bold), Paragraph(booking.booking_reference, body_style)],
            [Paragraph("Created At", body_bold), Paragraph(booking.created_at.strftime('%Y-%m-%d %H:%M') if booking.created_at else "—", body_style),
             Paragraph("Total Amount", body_bold), Paragraph(f"INR {booking.total_amount}", body_style)]
        ]
        
    itinerary_table = Table(itinerary_data, colWidths=[1.5*inch, 2.0*inch, 1.5*inch, 2.0*inch])
    itinerary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(itinerary_table)
    story.append(Spacer(1, 10))

    # 3.5 Flight & Train Passenger Details Table
    if vertical in ["flights", "trains"] and ticket and getattr(ticket, "passenger_details", None):
        story.append(Paragraph("PASSENGER & SEAT/BERTH ALLOCATIONS", section_style))
        pass_headers = [
            Paragraph("<b>Name</b>", body_bold),
            Paragraph("<b>Age</b>", body_bold),
            Paragraph("<b>Seat/Berth</b>", body_bold),
            Paragraph("<b>Type / Details</b>", body_bold),
            Paragraph("<b>Price</b>", body_bold)
        ]
        pass_rows = [pass_headers]
        for p in ticket.passenger_details:
            name = p.get("fullName") or p.get("name") or "Guest"
            age = str(p.get("age", "—"))
            
            # Seat/Berth allocation
            seat_num = p.get("seat_number", "—")
            seat_type = str(p.get("seat_type", "")).upper()
            
            if vertical == "flights":
                fare_type = str(p.get("specialFareType", "regular")).upper()
                verif_id = ""
                if p.get("studentId"):
                    raw_id = p.get("studentId")
                    masked_id = (raw_id[:3] + "*****") if len(raw_id) > 4 else (raw_id[:1] + "***")
                    verif_id = f" [Student: {masked_id}]"
                elif p.get("serviceId"):
                    verif_id = f" [Armed Forces: {p.get('serviceId')}]"
                details_str = f"{seat_type} | {fare_type}{verif_id}"
                
                final_fare = p.get("finalFare")
                if final_fare is not None:
                    fare_str = f"INR {float(final_fare):.2f}"
                else:
                    fare_str = f"INR {float(booking.total_amount) / len(ticket.passenger_details):.2f}"
            else: # trains
                coach = getattr(booking, "coach_class", "3A")
                details_str = f"{seat_type} | Coach {coach}"
                
                pricing_snap = getattr(booking, "pricing_snapshot", {}) or {}
                seat_fare = float(pricing_snap.get("seat_fare", 0.0) or 0.0)
                base_fare = float(pricing_snap.get("base_fare", float(booking.total_amount) - seat_fare))
                pax_base = base_fare / len(ticket.passenger_details)
                pax_seat = float(p.get("seat_price", 0.0) or 0.0)
                fare_str = f"INR {pax_base + pax_seat:.2f}"

            pass_rows.append([
                Paragraph(name, body_style),
                Paragraph(age, body_style),
                Paragraph(seat_num, body_style),
                Paragraph(details_str, body_style),
                Paragraph(fare_str, body_style)
            ])
            
        pass_table = Table(pass_rows, colWidths=[2.0*inch, 0.8*inch, 1.2*inch, 1.8*inch, 1.2*inch])
        pass_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f8fafc')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('PADDING', (0,0), (-1,-1), 5),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(pass_table)
        story.append(Spacer(1, 10))

    # 4. Billing & Invoice details
    story.append(Paragraph("BILLING & PAYMENT RECEIPT", section_style))
    invoice_data = [
        [Paragraph("Invoice Number", body_bold), Paragraph(invoice.invoice_number, body_style),
         Paragraph("GST Number", body_bold), Paragraph(invoice.gst_number, body_style)],
        [Paragraph("Base Amount", body_bold), Paragraph(f"INR {float(invoice.base_amount):.2f}", body_style),
         Paragraph("Taxes", body_bold), Paragraph(f"INR {float(invoice.tax_amount):.2f}", body_style)],
        [Paragraph("Discounts", body_bold), Paragraph(f"INR {float(invoice.discount_amount):.2f}", body_style),
         Paragraph("Wallet Used", body_bold), Paragraph(f"INR {float(invoice.wallet_used):.2f}", body_style)],
        [Paragraph("Payment Method", body_bold), Paragraph(invoice.payment_method.upper(), body_style),
         Paragraph("Final Amount Paid", body_bold), Paragraph(f"<b>INR {float(invoice.final_amount):.2f}</b>", ParagraphStyle('FinalAmt', parent=body_style, textColor=colors.HexColor('#2563eb')))]
    ]
    invoice_table = Table(invoice_data, colWidths=[1.5*inch, 2.0*inch, 1.5*inch, 2.0*inch])
    invoice_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(invoice_table)
    story.append(Spacer(1, 15))

    # 5. Terms / Footer
    story.append(Paragraph("<b>Terms & Conditions:</b> This E-Ticket is valid for travel with respective carriers. Refunds are computed as per the cancellation policy. Please carry a valid government photo ID for boarding/check-in.", ParagraphStyle('TermsStyle', fontName='Helvetica', fontSize=7, textColor=colors.HexColor('#94a3b8'), leading=9)))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Support Helplines:</b> For assistance, reach out to Ghumne Chale support at <b>+1-800-TRV-HELP</b> or email <b>support@travelos.com</b>.", ParagraphStyle('SupportStyle', fontName='Helvetica', fontSize=7, textColor=colors.HexColor('#94a3b8'), leading=9)))

    doc.build(story)
    return f"/static/tickets/{booking.booking_reference}.pdf"
