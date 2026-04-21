import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from scholarapp.models import (
    Office, User, ScholarProfile, ModeratorProfile,
    ServiceLog, Announcement, Voucher, VoucherApplication, Penalty
)

OFFICES = [
    "Office of Admissions",
    "Registrar's Office",
    "Student Affairs Office",
    "Library Services",
    "IT Services",
    "Finance Office",
    "Health Services",
    "Campus Ministry",
]

PROGRAMS = [
    "BS Computer Science", "BS Information Technology", "BS Biology",
    "BS Chemistry", "BA Communication", "BA Philosophy",
    "BS Management", "BS Accountancy", "BA Political Science",
    "BS Psychology",
]

GRANTS = ["Full Grant", "Partial Grant", "Merit Scholarship", "Need-Based Grant"]

SCHOOLS = ["SOSE", "SOH", "JGSOM", "RGLSOSS", "GBSEALD"]

ACTIVITIES = [
    "Assisted with document filing and organization",
    "Helped incoming students with enrollment queries",
    "Maintained and catalogued library resources",
    "Supported IT helpdesk operations",
    "Assisted in campus event coordination",
    "Helped prepare financial documents",
    "Provided front desk support",
    "Assisted with health screening procedures",
    "Supported online registration systems",
    "Helped organize student records",
]

ANNOUNCEMENT_TITLES = [
    ("GENERAL", "Welcome to the New Semester", "This semester brings exciting opportunities for all scholars. Stay tuned for updates."),
    ("URGENT", "Submission Deadline Reminder", "Please submit your service hours by end of month. Failure to comply may affect your scholarship status."),
    ("VOLUNTEER", "Tree Planting Activity This Saturday", "Join us for a community tree planting activity at the school grounds. Open to all scholars."),
    ("OPPORTUNITY", "Internship Openings at Partner Companies", "Several partner companies are offering summer internship slots exclusively for scholars."),
    ("FOODSTUBS", "Canteen Food Stub Distribution", "Food stubs for this month will be distributed at the Scholar Services Office starting Monday."),
    ("GENERAL", "Scholarship Renewal Requirements", "Reminder: Submit your academic records and service hour logs before the deadline."),
    ("URGENT", "System Maintenance Notice", "The scholar portal will be unavailable this Sunday from 12AM–6AM for scheduled maintenance."),
    ("VOLUNTEER", "Community Outreach Program", "Scholars are invited to join our community outreach program next weekend. Sign up at the SAO."),
]

VOUCHER_DATA = [
    ("FOODSTUB", "EBAIS Canteen Meal Voucher", "Get one free meal at EBAIS canteen.", "EBAIS", 50),
    ("FOODSTUB", "Kitchen City Lunch Stub", "Avail a subsidized lunch at Kitchen City.", "Kitchen City", 30),
    ("ENTERTAINMENT", "Cinema Discount Pass", "50% off on movie tickets at partner cinemas.", "SM Cinema", 20),
    ("TRANSPORT", "Grab Ride Voucher", "PHP 50 discount on your next Grab ride.", "Grab", 40),
    ("WELLNESS", "Gym Day Pass", "One free day pass at the campus gym.", "Campus Fitness Center", 25),
    ("ACADEMIC", "Bookstore Discount Voucher", "10% off on school supplies and books.", "National Bookstore", 60),
]

PENALTY_REASONS = [
    "Missed required service hours for the month",
    "Failure to submit monthly service log",
    "Unexcused absence from mandatory scholar assembly",
    "Late submission of academic records",
    "Violation of scholar code of conduct",
]


class Command(BaseCommand):
    help = "Seed the database with mock data"

    def handle(self, *args, **options):
        self.stdout.write("Seeding database...")

        # Offices
        offices = []
        for name in OFFICES:
            office, _ = Office.objects.get_or_create(name=name)
            offices.append(office)
        self.stdout.write(f"  Created {len(offices)} offices")

        # Admin
        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults=dict(email="admin@scholars.edu", role="ADMIN", is_email_verified=True, is_staff=True, is_superuser=True)
        )
        admin.set_password("admin1234")
        admin.save()

        # Moderators
        moderators = []
        for i, office in enumerate(offices[:5]):
            username = f"moderator{i+1}"
            mod_user, _ = User.objects.get_or_create(
                username=username,
                defaults=dict(
                    email=f"{username}@scholars.edu",
                    first_name=f"Moderator",
                    last_name=f"{i+1}",
                    role="MODERATOR",
                    is_email_verified=True,
                )
            )
            mod_user.set_password("mod1234")
            mod_user.save()
            ModeratorProfile.objects.get_or_create(
                user=mod_user,
                defaults=dict(office_name=office.name)
            )
            moderators.append(mod_user)
        self.stdout.write(f"  Created {len(moderators)} moderators")

        # Scholars
        scholars = []
        first_names = ["Juan", "Maria", "Jose", "Ana", "Carlos", "Sofia", "Luis", "Elena", "Miguel", "Isabella",
                       "Rafael", "Camila", "Diego", "Valentina", "Andres", "Lucia", "Jorge", "Daniela", "Marco", "Andrea"]
        last_names = ["Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Garcia", "Lim", "Torres", "Ramos", "Villanueva"]

        for i in range(20):
            username = f"scholar{i+1}"
            student_id = f"{100 + i:06d}"
            scholar_user, _ = User.objects.get_or_create(
                username=username,
                defaults=dict(
                    email=f"{username}@scholars.edu",
                    first_name=first_names[i],
                    last_name=last_names[i % len(last_names)],
                    role="SCHOLAR",
                    is_email_verified=True,
                )
            )
            scholar_user.set_password("scholar1234")
            scholar_user.save()

            profile, _ = ScholarProfile.objects.get_or_create(
                user=scholar_user,
                defaults=dict(
                    student_id=student_id,
                    program_course=random.choice(PROGRAMS),
                    scholar_grant=random.choice(GRANTS),
                    is_dormer=random.choice([True, False]),
                    school=random.choice(SCHOOLS),
                )
            )
            scholars.append((scholar_user, profile))
        self.stdout.write(f"  Created {len(scholars)} scholars")

        # Service logs (2-5 per scholar)
        log_count = 0
        for scholar_user, profile in scholars:
            num_logs = random.randint(2, 5)
            for _ in range(num_logs):
                days_ago = random.randint(1, 90)
                office = random.choice(offices)
                moderator = random.choice(moderators)
                ServiceLog.objects.get_or_create(
                    scholar=profile,
                    date_rendered=date.today() - timedelta(days=days_ago),
                    office_name=office.name,
                    defaults=dict(
                        hours=random.choice([1.0, 1.5, 2.0, 2.5, 3.0, 4.0]),
                        activity_description=random.choice(ACTIVITIES),
                        created_by=moderator,
                    )
                )
                log_count += 1
        self.stdout.write(f"  Created {log_count} service logs")

        # Announcements
        ann_count = 0
        for category, title, content in ANNOUNCEMENT_TITLES:
            author = random.choice(moderators + [admin])
            Announcement.objects.get_or_create(
                title=title,
                defaults=dict(
                    content=content,
                    category=category,
                    status="APPROVED",
                    author=author,
                )
            )
            ann_count += 1
        self.stdout.write(f"  Created {ann_count} announcements")

        # Vouchers
        vouchers = []
        for category, title, desc, provider, slots in VOUCHER_DATA:
            voucher, _ = Voucher.objects.get_or_create(
                title=title,
                defaults=dict(
                    description=desc,
                    category=category,
                    provider=provider,
                    total_slots=slots,
                    remaining_slots=random.randint(slots // 2, slots),
                    status="ACTIVE",
                    expiry_date=date.today() + timedelta(days=random.randint(14, 60)),
                    created_by=admin,
                )
            )
            vouchers.append(voucher)
        self.stdout.write(f"  Created {len(vouchers)} vouchers")

        # Voucher applications (random scholars apply to random vouchers)
        app_count = 0
        for scholar_user, _ in random.sample(scholars, min(10, len(scholars))):
            voucher = random.choice(vouchers)
            _, created = VoucherApplication.objects.get_or_create(
                voucher=voucher,
                scholar=scholar_user,
                defaults=dict(status=random.choice(["PENDING", "APPROVED", "CLAIMED"]))
            )
            if created:
                app_count += 1
        self.stdout.write(f"  Created {app_count} voucher applications")

        # Penalties (3-5 random scholars)
        pen_count = 0
        for scholar_user, _ in random.sample(scholars, min(5, len(scholars))):
            Penalty.objects.get_or_create(
                scholar=scholar_user,
                reason=random.choice(PENALTY_REASONS),
                defaults=dict(
                    status=random.choice(["ACTIVE", "RESOLVED"]),
                    created_by=admin,
                    notes="Auto-generated mock penalty.",
                )
            )
            pen_count += 1
        self.stdout.write(f"  Created {pen_count} penalties")

        self.stdout.write(self.style.SUCCESS("\nDatabase seeded successfully!"))
        self.stdout.write("  admin / admin1234")
        self.stdout.write("  moderator1-5 / mod1234")
        self.stdout.write("  scholar1-20 / scholar1234")
