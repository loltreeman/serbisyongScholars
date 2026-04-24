from django.core.management.base import BaseCommand
from scholarapp.models import ScholarProfile

class Command(BaseCommand):
    help = "Update total_hours_rendered for all scholar profiles based on their service logs"

    def handle(self, *args, **options):
        scholars = ScholarProfile.objects.all()
        updated = 0
        for scholar in scholars:
            old_total = scholar.total_hours_rendered
            scholar.update_hours_from_logs()
            if scholar.total_hours_rendered != old_total:
                updated += 1
                self.stdout.write(f"Updated {scholar.user.username}: {old_total} -> {scholar.total_hours_rendered}")
        
        self.stdout.write(self.style.SUCCESS(f"Updated {updated} scholar profiles"))