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

    # 1. Header Row (Logo / Travel OS Branding + QR)
    qr_img_path = f"static/qrcodes/{booking.booking_reference}.png"
    if not os.path.exists(qr_img_path):
        generate_qr_code(booking.booking_reference)
        
    qr_img = Image(qr_img_path, width=1.1*inch, height=1.1*inch)
    
    header_data = [
        [
            Paragraph("TRAVEL OS", ParagraphStyle('LogoText', fontName='Helvetica-Bold', fontSize=22, textColor=colors.HexColor('#2563eb'))),
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
        [Paragraph("Customer Name", body_bold), Paragraph(getattr(user, "name", "") or getattr(user, "username", "Guest"), body_style),
         Paragraph("Customer Email", body_bold), Paragraph(user.email, body_style)]
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
    story.append(Paragraph("<b>Support Helplines:</b> For assistance, reach out to Travel OS support at <b>+1-800-TRV-HELP</b> or email <b>support@travelos.com</b>.", ParagraphStyle('SupportStyle', fontName='Helvetica', fontSize=7, textColor=colors.HexColor('#94a3b8'), leading=9)))

    doc.build(story)
    return f"/static/tickets/{booking.booking_reference}.pdf"
